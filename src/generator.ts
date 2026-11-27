import type { Piece, PieceType } from './types';
import { isKingInCheck } from './gameLogic';
import { MateSearch, applyMove, legalMoves } from './puzzleEngine';
import { codeOf, type Puzzle } from './puzzles';

// 隨機出題：以種子決定的亂數擺出殘局，再用規則引擎確認「恰好 n 步殺」才採用。
// 同一個種子與步數一定產生同一題。

export function rng(seed: number) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Spot = [PieceType, number, number];

// 黑方守備陣型（皆為合法位置：將與士在九宮內、象在象位）
const formations: Spot[][] = [
  [['king', 0, 4], ['advisor', 0, 3], ['advisor', 0, 5]],
  [['king', 0, 4], ['advisor', 1, 4], ['advisor', 0, 3], ['elephant', 0, 2]],
  [['king', 0, 3], ['advisor', 0, 4], ['advisor', 1, 4], ['elephant', 0, 2]],
  [['king', 0, 4], ['advisor', 0, 5], ['elephant', 2, 4], ['elephant', 0, 6]],
  [['king', 1, 4], ['advisor', 0, 3], ['advisor', 0, 5], ['elephant', 2, 2]],
  [['king', 0, 5], ['advisor', 1, 4], ['elephant', 0, 6]],
  [['king', 0, 4], ['advisor', 0, 3], ['advisor', 0, 5], ['elephant', 0, 2], ['elephant', 0, 6]],
];

const attackers: PieceType[] = ['rook', 'rook', 'cannon', 'cannon', 'horse', 'horse', 'pawn'];
const MAX_ATTEMPTS = 400000;

const limits: Record<1 | 2 | 3, { pieces: [number, number]; maxSolutions: number }> = {
  1: { pieces: [2, 3], maxSolutions: 3 },
  2: { pieces: [3, 3], maxSolutions: 2 },
  3: { pieces: [3, 3], maxSolutions: 2 },
};

function randomPosition(random: () => number, count: number): Piece[] {
  const pick = (n: number) => Math.floor(random() * n);
  const pieces: Piece[] = [];
  const used = new Set<number>();
  const put = (type: PieceType, color: 'red' | 'black', row: number, col: number) => {
    used.add(row * 9 + col);
    pieces.push({ id: color[0] + pieces.length + type, type, color, row, col });
  };
  for (const [type, row, col] of formations[pick(formations.length)]) put(type, 'black', row, col);
  put('king', 'red', 7 + pick(3), 3 + pick(3));
  for (let i = 0; i < count; i++) {
    const type = attackers[pick(attackers.length)];
    let row: number;
    let col: number;
    do {
      // 兵只放在已過河（0–4 列）或河口（5–6 列）
      row = type === 'pawn' ? pick(7) : pick(9);
      col = pick(9);
    } while (used.has(row * 9 + col));
    put(type, 'red', row, col);
  }
  return pieces;
}

// 每顆紅方攻擊子都必須有作用：拿掉任何一顆，就不再能在 n 步內將死。
function everyPieceMatters(pieces: Piece[], n: number): boolean {
  for (const piece of pieces) {
    if (piece.color !== 'red' || piece.type === 'king') continue;
    const without = pieces.filter(item => item !== piece);
    if (isKingInCheck(without, 'black') || isKingInCheck(without, 'red')) continue;
    if (new MateSearch('red').within(without, n)) return false;
  }
  return true;
}

export function generatePuzzle(seed: number, mateIn: 1 | 2 | 3): Puzzle {
  const random = rng(seed);
  const { pieces: [low, high], maxSolutions } = limits[mateIn];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const count = low + Math.floor(random() * (high - low + 1));
    const pieces = randomPosition(random, count);
    if (isKingInCheck(pieces, 'black') || isKingInCheck(pieces, 'red')) continue;
    // 快速篩選：紅方至少要有一步能將軍
    if (!legalMoves(pieces, 'red').some(m => isKingInCheck(applyMove(pieces, m), 'black'))) continue;
    if (legalMoves(pieces, 'black').length === 0) continue;
    const search = new MateSearch('red');
    if (search.shortest(pieces, mateIn) !== mateIn) continue;
    if (search.solutions(pieces, mateIn).length > maxSolutions) continue;
    if (!everyPieceMatters(pieces, mateIn)) continue;
    const id = 'r' + mateIn + '-' + seed;
    return {
      id, seed, mateIn,
      title: '隨機題 #' + seed,
      goal: '紅先，' + ['', '一', '兩', '三'][mateIn] + '步殺。這題由程式隨機產生，並經規則引擎驗證。',
      hints: ['先找出所有能將軍的走法，再看黑將還剩哪些出路。'],
      retry: '這步沒有保證將死——再看看黑將還能往哪裡走。',
      pieces: pieces.map(piece => [piece.color === 'red' ? 'r' : 'b', codeOf(piece.type), piece.row, piece.col]),
      solution: search.mainLine(pieces, mateIn),
    };
  }
  throw new Error('在嘗試次數內找不到符合條件的題目');
}
