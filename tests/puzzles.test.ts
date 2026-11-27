import test from 'node:test';
import assert from 'node:assert/strict';
import { isKingInCheck } from '../src/gameLogic';
import {
  applyMove, givesCheckmate, isLegal, legalMoves, mateInOneMoves, mateInTwoLines, sameMove, toughestReply,
} from '../src/puzzleEngine';
import { analyzePuzzle, buildPieces, puzzles } from '../src/puzzles';

test('題庫：5 題，3 道一步殺與 2 道兩步殺', () => {
  assert.equal(puzzles.length, 5);
  assert.equal(puzzles.filter(p => p.mateIn === 1).length, 3);
  assert.equal(puzzles.filter(p => p.mateIn === 2).length, 2);
  assert.equal(new Set(puzzles.map(p => p.id)).size, 5);
});

for (const puzzle of puzzles) {
  test(puzzle.id + ' ' + puzzle.title + '：起始盤面合法', () => {
    const pieces = buildPieces(puzzle);
    const kings = pieces.filter(p => p.type === 'king');
    assert.equal(kings.length, 2);
    const cells = new Set(pieces.map(p => p.row + ',' + p.col));
    assert.equal(cells.size, pieces.length, '不可有兩顆棋子在同一格');
    assert.equal(isKingInCheck(pieces, 'red'), false, '紅方起始不可被將軍（含將帥對面）');
    assert.equal(isKingInCheck(pieces, 'black'), false, '黑方起始不可被將軍（含將帥對面）');
    assert.ok(legalMoves(pieces, 'black').length > 0 || puzzle.mateIn === 2, '黑方起始需有走法或為引將題');
  });

  test(puzzle.id + ' ' + puzzle.title + '：主解逐步合法並以將死收尾', () => {
    let pieces = buildPieces(puzzle);
    puzzle.solution.forEach((move, i) => {
      const side = i % 2 === 0 ? 'red' : 'black';
      assert.ok(isLegal(pieces, side, move), '第 ' + (i + 1) + ' 手需為合法走法');
      pieces = applyMove(pieces, move);
    });
    assert.equal(puzzle.solution.length, puzzle.mateIn * 2 - 1);
    assert.ok(givesCheckmate(pieces, 'black'));
  });

  test(puzzle.id + ' ' + puzzle.title + '：引擎判定的正解包含主解，且題目屬實', () => {
    const pieces = buildPieces(puzzle);
    const { firstMoves } = analyzePuzzle(puzzle);
    assert.ok(firstMoves.length >= 1);
    assert.ok(firstMoves.some(m => sameMove(m, puzzle.solution[0])), '主解第一步需被接受');
    const oneMove = mateInOneMoves(pieces, 'red');
    if (puzzle.mateIn === 1) assert.ok(oneMove.length >= 1);
    else assert.equal(oneMove.length, 0, '兩步殺題不得存在一步殺');
  });
}

for (const puzzle of puzzles.filter(p => p.mateIn === 2)) {
  test(puzzle.id + ' ' + puzzle.title + '：每個正解第一步，對黑方「全部」合法應手都有將死', () => {
    const pieces = buildPieces(puzzle);
    const lines = mateInTwoLines(pieces, 'red');
    assert.ok(lines.length >= 1);
    for (const line of lines) {
      const afterFirst = applyMove(pieces, line.first);
      const replies = legalMoves(afterFirst, 'black');
      assert.equal(line.replies.length, replies.length, '應手數需與規則引擎的全部合法應手一致');
      for (const reply of replies) {
        const mates = mateInOneMoves(applyMove(afterFirst, reply), 'red');
        assert.ok(mates.length >= 1, '應手後必須有將死');
        for (const mate of mates) {
          assert.ok(givesCheckmate(applyMove(applyMove(afterFirst, reply), mate), 'black'));
        }
      }
      assert.ok(isLegal(afterFirst, 'black', toughestReply(line)));
    }
    // 主解的黑方應手必須是合法應手
    const afterMain = applyMove(pieces, puzzle.solution[0]);
    assert.ok(isLegal(afterMain, 'black', puzzle.solution[1]));
  });

  test(puzzle.id + ' ' + puzzle.title + '：非正解的第一步不會被接受', () => {
    const pieces = buildPieces(puzzle);
    const accepted = analyzePuzzle(puzzle).firstMoves;
    const wrong = legalMoves(pieces, 'red').filter(m => !accepted.some(a => sameMove(a, m)));
    assert.ok(wrong.length > 0);
    const forced = new Set(mateInTwoLines(pieces, 'red').map(l => JSON.stringify(l.first)));
    for (const move of wrong) assert.ok(!forced.has(JSON.stringify(move)));
  });
}

test('一步殺題：被接受的走法 = 引擎全部將死走法（多解皆收）', () => {
  const p1 = puzzles[0];
  const accepted = analyzePuzzle(p1).firstMoves;
  assert.equal(accepted.length, 2, '第 1 題有兩個正解');
  for (const puzzle of puzzles.filter(p => p.mateIn === 1)) {
    const pieces = buildPieces(puzzle);
    const all = legalMoves(pieces, 'red').filter(m => givesCheckmate(applyMove(pieces, m), 'black'));
    assert.deepEqual(analyzePuzzle(puzzle).firstMoves, all);
  }
});
