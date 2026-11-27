import test from 'node:test';
import assert from 'node:assert/strict';
import type { Piece } from '../src/types';
import { isKingInCheck } from '../src/gameLogic';
import { MateSearch, applyMove, givesCheckmate, isLegal, legalMoves, sameMove, type Move } from '../src/puzzleEngine';
import { buildPieces, puzzles, type Puzzle } from '../src/puzzles';
import { generatePuzzle } from '../src/generator';
import { runEngine } from '../src/engineCore';

// 窮舉驗證：紅方在 n 步內能將死時，回傳被接受的走法；並且對每一個被接受的走法，
// 逐一走過黑方「全部」合法應手，確認應手後紅方仍能在剩餘步數內將死。
function verifyTree(pieces: Piece[], n: number, search: MateSearch): number {
  const accepted = search.solutions(pieces, n);
  assert.ok(accepted.length > 0, '剩 ' + n + ' 步時必須至少有一個正解');
  let leaves = 0;
  for (const move of accepted) {
    const after = applyMove(pieces, move);
    if (givesCheckmate(after, 'black')) { leaves++; continue; }
    assert.ok(n > 1, '最後一步必須直接將死');
    const replies = legalMoves(after, 'black');
    assert.ok(replies.length > 0, '黑方沒有應手卻未被將死（困斃）不算正解');
    for (const reply of replies) leaves += verifyTree(applyMove(after, reply), n - 1, search);
  }
  return leaves;
}

// 驗證「不被接受」的走法確實無法保證在 n 步內將死：黑方至少有一種應手可以撐過剩餘步數。
function verifyRejected(pieces: Piece[], n: number, search: MateSearch) {
  const accepted = search.solutions(pieces, n);
  for (const move of legalMoves(pieces, 'red')) {
    if (accepted.some(a => sameMove(a, move))) continue;
    const after = applyMove(pieces, move);
    assert.equal(givesCheckmate(after, 'black'), false);
    if (n === 1) continue;
    const replies = legalMoves(after, 'black');
    assert.ok(replies.length === 0 || replies.some(r => !search.within(applyMove(after, r), n - 1)));
  }
}

function checkStart(puzzle: Puzzle) {
  const pieces = buildPieces(puzzle);
  assert.equal(pieces.filter(p => p.type === 'king').length, 2);
  assert.equal(new Set(pieces.map(p => p.row + ',' + p.col)).size, pieces.length, '不可有兩顆棋子在同一格');
  assert.equal(isKingInCheck(pieces, 'red'), false, '紅方起始不可被將軍（含將帥對面）');
  assert.equal(isKingInCheck(pieces, 'black'), false, '黑方起始不可被將軍（含將帥對面）');
  return pieces;
}

function checkSolution(puzzle: Puzzle) {
  let pieces = buildPieces(puzzle);
  const search = new MateSearch('red');
  puzzle.solution.forEach((move: Move, i) => {
    const side = i % 2 === 0 ? 'red' : 'black';
    assert.ok(isLegal(pieces, side, move), '主解第 ' + (i + 1) + ' 手需為合法走法');
    if (side === 'red') {
      const left = puzzle.mateIn - i / 2;
      assert.ok(search.solutions(pieces, left).some(m => sameMove(m, move)), '主解第 ' + (i + 1) + ' 手需被接受');
    }
    pieces = applyMove(pieces, move);
  });
  assert.equal(puzzle.solution.length, puzzle.mateIn * 2 - 1, '主解長度需為 2n-1 手');
  assert.ok(givesCheckmate(pieces, 'black'), '主解最後需將死');
}

test('題庫：13 題（6 道一步殺、4 道兩步殺、3 道三步殺），編號不重複', () => {
  assert.equal(puzzles.length, 13);
  assert.equal(puzzles.filter(p => p.mateIn === 1).length, 6);
  assert.equal(puzzles.filter(p => p.mateIn === 2).length, 4);
  assert.equal(puzzles.filter(p => p.mateIn === 3).length, 3);
  assert.equal(new Set(puzzles.map(p => p.id)).size, puzzles.length);
  for (const p of puzzles) assert.ok(p.hints.length >= 1 && p.retry.length > 0);
});

for (const puzzle of puzzles) {
  const label = puzzle.id + ' ' + puzzle.title + '（' + puzzle.mateIn + ' 步殺）';
  test(label + '：起始合法、恰好 ' + puzzle.mateIn + ' 步殺、主解正確', () => {
    const pieces = checkStart(puzzle);
    assert.equal(new MateSearch('red').shortest(pieces, puzzle.mateIn), puzzle.mateIn, '不得存在更短的殺法');
    checkSolution(puzzle);
  });
  test(label + '：每個正解對黑方全部合法應手都能將死；其餘走法都被拒絕', () => {
    const pieces = buildPieces(puzzle);
    const search = new MateSearch('red');
    const leaves = verifyTree(pieces, puzzle.mateIn, search);
    assert.ok(leaves > 0);
    verifyRejected(pieces, puzzle.mateIn, search);
  });
}

test('多解：第 1 題、第 6 題、第 13 題各有兩個被接受的第一步', () => {
  for (const id of ['p1', 'p6', 'p13']) {
    const puzzle = puzzles.find(p => p.id === id)!;
    assert.equal(new MateSearch('red').solutions(buildPieces(puzzle), puzzle.mateIn).length, 2, id);
  }
});

test('同題多種應手：第 9、12、13 題黑方在第一步後有多種合法應手', () => {
  for (const id of ['p9', 'p12', 'p13']) {
    const puzzle = puzzles.find(p => p.id === id)!;
    const after = applyMove(buildPieces(puzzle), puzzle.solution[0]);
    assert.ok(legalMoves(after, 'black').length >= 2, id);
  }
});

test('引擎服務：隨機應手只回傳合法且仍可被將死的應手；最頑強模式走主解時沿用主解', () => {
  const puzzle = puzzles.find(p => p.id === 'p9')!;
  const after = applyMove(buildPieces(puzzle), puzzle.solution[0]);
  const seen = new Set<string>();
  for (const random of [0, 0.3, 0.6, 0.99]) {
    const reply = runEngine({ type: 'reply', pieces: after, remaining: 1, mode: 'random', preferred: null, random }) as Move;
    assert.ok(isLegal(after, 'black', reply));
    assert.ok(new MateSearch('red').within(applyMove(after, reply), 1));
    seen.add(JSON.stringify(reply));
  }
  assert.ok(seen.size >= 2, '隨機模式應能產生不同應手');
  const tough = runEngine({ type: 'reply', pieces: after, remaining: 1, mode: 'toughest', preferred: puzzle.solution[1], random: 0 }) as Move;
  assert.ok(sameMove(tough, puzzle.solution[1]));
});

for (const [mateIn, seeds] of [[1, [1, 2, 3, 4, 5]], [2, [11, 12, 13]], [3, [21]]] as const) {
  test('隨機出題：' + mateIn + ' 步殺（種子 ' + seeds.join(', ') + '）皆通過完整驗證且可重現', () => {
    for (const seed of seeds) {
      const puzzle = generatePuzzle(seed, mateIn);
      assert.equal(puzzle.mateIn, mateIn);
      assert.deepEqual(generatePuzzle(seed, mateIn).pieces, puzzle.pieces, '同一種子需產生同一題');
      const pieces = checkStart(puzzle);
      assert.equal(new MateSearch('red').shortest(pieces, mateIn), mateIn);
      checkSolution(puzzle);
      verifyTree(pieces, mateIn, new MateSearch('red'));
    }
  });
}
