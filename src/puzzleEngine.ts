import type { Piece, PieceColor, Position } from './types';
import { getValidMoves, isCheckmate, isKingInCheck } from './gameLogic';

// 殘局挑戰使用的走法判斷。所有合法性檢查都交給 gameLogic 的規則引擎。
export interface Move {
  from: Position;
  to: Position;
}

export const sameMove = (a: Move, b: Move) =>
  a.from.row === b.from.row && a.from.col === b.from.col &&
  a.to.row === b.to.row && a.to.col === b.to.col;

export const other = (side: PieceColor): PieceColor => (side === 'red' ? 'black' : 'red');

export const pieceAt = (pieces: Piece[], { row, col }: Position) =>
  pieces.find(piece => piece.row === row && piece.col === col);

// 套用一步走法（會吃掉目標格上的棋子）。不做合法性檢查。
export function applyMove(pieces: Piece[], { from, to }: Move): Piece[] {
  const mover = pieceAt(pieces, from);
  if (!mover) throw new Error('起點沒有棋子：' + from.row + ',' + from.col);
  return pieces
    .filter(piece => !(piece.row === to.row && piece.col === to.col))
    .map(piece => (piece.id === mover.id ? { ...piece, row: to.row, col: to.col } : piece));
}

// 某一方所有合法走法（已排除會讓自己被將軍的走法）。
export function legalMoves(pieces: Piece[], side: PieceColor): Move[] {
  const moves: Move[] = [];
  for (const piece of pieces) {
    if (piece.color !== side) continue;
    for (const to of getValidMoves(piece, pieces)) {
      moves.push({ from: { row: piece.row, col: piece.col }, to });
    }
  }
  return moves;
}

export const isLegal = (pieces: Piece[], side: PieceColor, move: Move) =>
  legalMoves(pieces, side).some(candidate => sameMove(candidate, move));

// 走完 pieces 之後，對方是否被將死：必須正在被將軍，且沒有任何合法走法。
export function givesCheckmate(afterMove: Piece[], defender: PieceColor): boolean {
  return isKingInCheck(afterMove, defender) && isCheckmate(afterMove, defender);
}

// side 一步殺：回傳所有能將死對方的合法走法。
export function mateInOneMoves(pieces: Piece[], side: PieceColor): Move[] {
  const defender = other(side);
  return legalMoves(pieces, side).filter(move => givesCheckmate(applyMove(pieces, move), defender));
}

export interface MateInTwoLine {
  first: Move;
  // 對方每一個合法應手，以及對應的所有將死走法（每項至少一個）。
  replies: { reply: Move; mates: Move[] }[];
}

// side 兩步殺：回傳所有「不論對方怎麼應，下一步都有將死」的第一步。
// 第一步本身若已經是將死，不算兩步殺的解（屬於一步殺）。
export function mateInTwoLines(pieces: Piece[], side: PieceColor): MateInTwoLine[] {
  const defender = other(side);
  const lines: MateInTwoLine[] = [];
  for (const first of legalMoves(pieces, side)) {
    const afterFirst = applyMove(pieces, first);
    if (givesCheckmate(afterFirst, defender)) continue;
    const replies = legalMoves(afterFirst, defender);
    if (replies.length === 0) continue;
    const detail: MateInTwoLine['replies'] = [];
    let forced = true;
    for (const reply of replies) {
      const afterReply = applyMove(afterFirst, reply);
      const mates = mateInOneMoves(afterReply, side);
      if (mates.length === 0) { forced = false; break; }
      detail.push({ reply, mates });
    }
    if (forced) lines.push({ first, replies: detail });
  }
  return lines;
}

// 對方在 first 之後的「最頑強」應手：讓我方將死走法最少者；同數量時取走法順序最前者。
export function toughestReply(line: MateInTwoLine): Move {
  return line.replies.reduce((best, item) => (item.mates.length < best.mates.length ? item : best)).reply;
}

// ───────── 通用 N 步殺（用於三步殺、隨機應手與隨機出題） ─────────

const keyOf = (pieces: Piece[]) =>
  pieces.map(p => p.color[0] + p.type[0] + p.type[1] + p.row + p.col).sort().join('|');

// 將軍的走法排在前面，讓「存在」型搜尋更快找到解。
function ordered(pieces: Piece[], side: PieceColor): Move[] {
  const defender = other(side);
  const checks: Move[] = [];
  const quiet: Move[] = [];
  for (const move of legalMoves(pieces, side)) {
    (isKingInCheck(applyMove(pieces, move), defender) ? checks : quiet).push(move);
  }
  return [...checks, ...quiet];
}

export class MateSearch {
  private memoWithin = new Map<string, boolean>();
  private memoForced = new Map<string, boolean>();
  constructor(readonly side: PieceColor = 'red') {}

  get cacheSize() { return this.memoWithin.size + this.memoForced.size; }

  // 輪到 side 走：能否在 n 步（含）以內將死對方
  within(pieces: Piece[], n: number): boolean {
    if (n <= 0) return false;
    const key = n + ':' + keyOf(pieces);
    const cached = this.memoWithin.get(key);
    if (cached !== undefined) return cached;
    let found = false;
    for (const move of ordered(pieces, this.side)) {
      if (this.accepts(pieces, move, n)) { found = true; break; }
    }
    this.memoWithin.set(key, found);
    return found;
  }

  // 輪到對方走（我方剛走完）：不論對方怎麼應，我方都能在 n 步以內將死
  forced(afterMove: Piece[], n: number): boolean {
    const defender = other(this.side);
    if (givesCheckmate(afterMove, defender)) return true;
    if (n <= 0) return false;
    const key = n + ':' + keyOf(afterMove);
    const cached = this.memoForced.get(key);
    if (cached !== undefined) return cached;
    const replies = legalMoves(afterMove, defender);
    // 對方無子可動但未被將軍（困斃）不視為本題的將死
    let ok = replies.length > 0;
    for (const reply of replies) {
      if (!this.within(applyMove(afterMove, reply), n)) { ok = false; break; }
    }
    this.memoForced.set(key, ok);
    return ok;
  }

  // 在剩餘 n 步內，走 move 是否仍保證將死（含直接將死）
  accepts(pieces: Piece[], move: Move, n: number): boolean {
    const after = applyMove(pieces, move);
    if (givesCheckmate(after, other(this.side))) return true;
    return n > 1 && this.forced(after, n - 1);
  }

  // 所有「n 步以內保證將死」的第一步
  solutions(pieces: Piece[], n: number): Move[] {
    return legalMoves(pieces, this.side).filter(move => this.accepts(pieces, move, n));
  }

  // 最少需要幾步將死（超過 limit 回傳 null）
  shortest(pieces: Piece[], limit: number): number | null {
    for (let n = 1; n <= limit; n++) if (this.within(pieces, n)) return n;
    return null;
  }

  // 對方應手中，讓我方剩餘正解最少的一手（最頑強）
  toughest(afterMove: Piece[], n: number): Move | null {
    let best: Move | null = null;
    let bestCount = Infinity;
    for (const reply of legalMoves(afterMove, other(this.side))) {
      const count = this.solutions(applyMove(afterMove, reply), n).length;
      if (count < bestCount) { best = reply; bestCount = count; }
    }
    return best;
  }

  // 從 pieces 出發、n 步殺的一條主線（我方走第一個正解；對方走最頑強應手）
  mainLine(pieces: Piece[], n: number): Move[] {
    const line: Move[] = [];
    let current = pieces;
    for (let left = n; left >= 1; left--) {
      const move = this.solutions(current, left)[0];
      if (!move) break;
      line.push(move);
      current = applyMove(current, move);
      if (givesCheckmate(current, other(this.side))) break;
      const reply = this.toughest(current, left - 1);
      if (!reply) break;
      line.push(reply);
      current = applyMove(current, reply);
    }
    return line;
  }
}
