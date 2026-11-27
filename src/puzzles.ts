import type { Piece, PieceColor, PieceType } from './types';
import { mateInOneMoves, mateInTwoLines, type Move, type MateInTwoLine } from './puzzleEngine';

// 殘局挑戰題庫。座標沿用棋盤規則：row 0 在上方（黑方底線），row 9 在下方（紅方底線）；col 0–8 由左到右。
// 每題都是「紅先」。題目與主解由 tests/puzzles.test.ts 以規則引擎驗證。

type Code = 'K' | 'A' | 'E' | 'H' | 'R' | 'C' | 'P';
type PieceSpec = ['r' | 'b', Code, number, number];

const types: Record<Code, PieceType> = {
  K: 'king', A: 'advisor', E: 'elephant', H: 'horse', R: 'rook', C: 'cannon', P: 'pawn',
};

export interface Puzzle {
  id: string;
  title: string;
  mateIn: 1 | 2;
  // 一句話題目說明
  goal: string;
  // 提示（第一階段）。兩步殺的第二步使用 hintSecond。
  hint: string;
  hintSecond?: string;
  // 走錯時顯示的一句提示
  retry: string;
  pieces: PieceSpec[];
  // 主解：紅、（黑、紅）…。供「解答重播」與提示使用；其他正解由引擎另行判定。
  solution: Move[];
}

const m = (fr: number, fc: number, tr: number, tc: number): Move => ({
  from: { row: fr, col: fc }, to: { row: tr, col: tc },
});

export const puzzles: Puzzle[] = [
  {
    id: 'p1', title: '臥槽馬', mateIn: 1,
    goal: '紅先，一步殺。黑將被自己的雙士擋住左右，只剩一條出路。',
    hint: '黑將唯一的出路在第二橫線；紅車已經守住那裡，馬可以從側面將軍。',
    retry: '這步沒有將死——先找出黑將還能往哪裡逃。',
    pieces: [
      ['r', 'K', 9, 3], ['r', 'R', 1, 0], ['r', 'H', 4, 4],
      ['b', 'K', 0, 4], ['b', 'A', 0, 3], ['b', 'A', 0, 5], ['b', 'E', 2, 6], ['b', 'P', 3, 7],
    ],
    solution: [m(4, 4, 2, 3)],
  },
  {
    id: 'p2', title: '馬後炮', mateIn: 1,
    goal: '紅先，一步殺。炮已經瞄準第二橫線，缺的是一個「炮架」。',
    hint: '讓馬走到能將軍的位置，同時成為炮的炮架。',
    retry: '這步沒有將死——想想怎樣讓馬與炮同時發揮作用。',
    pieces: [
      ['r', 'K', 9, 3], ['r', 'H', 3, 5], ['r', 'C', 1, 7],
      ['b', 'K', 0, 4], ['b', 'A', 0, 3], ['b', 'A', 0, 5], ['b', 'E', 0, 2], ['b', 'P', 4, 6],
    ],
    solution: [m(3, 5, 1, 6)],
  },
  {
    id: 'p3', title: '重炮', mateIn: 1,
    goal: '紅先，一步殺。兩門炮同在中路，兵守著關鍵一格。',
    hint: '把另一門炮也調到中路，讓前面的炮成為後炮的炮架。',
    retry: '這步沒有將死——中路還有一門炮可以調動。',
    pieces: [
      ['r', 'K', 9, 3], ['r', 'P', 1, 3], ['r', 'C', 5, 5], ['r', 'C', 1, 4],
      ['b', 'K', 0, 4], ['b', 'A', 0, 3], ['b', 'A', 0, 5], ['b', 'P', 3, 0],
    ],
    solution: [m(5, 5, 5, 4)],
  },
  {
    id: 'p4', title: '引將入網', mateIn: 2,
    goal: '紅先，兩步殺。第一步不必將軍，但黑方只剩一種走法。',
    hint: '黑方除了將以外，其餘棋子都動不了；先讓炮去中路，看看黑將被迫往哪裡走。',
    hintSecond: '黑將被引到了第二橫線，用車從側面封住中路。',
    retry: '這步不夠緊——試著找出一步讓黑方別無選擇的走法。',
    pieces: [
      ['r', 'K', 9, 5], ['r', 'C', 5, 3], ['r', 'R', 4, 8], ['r', 'R', 4, 3],
      ['b', 'K', 0, 4], ['b', 'A', 0, 3], ['b', 'A', 0, 5],
    ],
    solution: [m(5, 3, 5, 4), m(0, 4, 1, 4), m(4, 8, 4, 4)],
  },
  {
    id: 'p5', title: '棄車引將', mateIn: 2,
    goal: '紅先，兩步殺。先犧牲一車，把黑將引到出路上。',
    hint: '用車吃掉黑士並將軍；另一輛車守著這一格，黑將不能吃回。',
    hintSecond: '黑將被迫走上第二橫線，另一輛車從同一條直線追上去。',
    retry: '這步沒有成殺——試試把車直接沉到黑方底線。',
    pieces: [
      ['r', 'K', 8, 4], ['r', 'H', 2, 4], ['r', 'R', 2, 3], ['r', 'R', 6, 3],
      ['b', 'K', 0, 4], ['b', 'A', 0, 3], ['b', 'A', 0, 5], ['b', 'E', 0, 6], ['b', 'P', 3, 8],
    ],
    solution: [m(2, 3, 0, 3), m(0, 4, 1, 4), m(6, 3, 1, 3)],
  },
];

export function buildPieces(puzzle: Puzzle): Piece[] {
  return puzzle.pieces.map(([side, code, row, col], index) => ({
    id: puzzle.id + '-' + side + code + index,
    type: types[code],
    color: (side === 'r' ? 'red' : 'black') as PieceColor,
    row, col,
  }));
}

export interface PuzzleAnalysis {
  // 所有被接受的第一步（引擎判定的全部正解）
  firstMoves: Move[];
  // 兩步殺才有：每個正解第一步對應的全部黑方應手與將死走法
  lines: MateInTwoLine[];
}

export function analyzePuzzle(puzzle: Puzzle): PuzzleAnalysis {
  const pieces = buildPieces(puzzle);
  if (puzzle.mateIn === 1) return { firstMoves: mateInOneMoves(pieces, 'red'), lines: [] };
  const lines = mateInTwoLines(pieces, 'red');
  return { firstMoves: lines.map(line => line.first), lines };
}
