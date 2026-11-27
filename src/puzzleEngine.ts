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
