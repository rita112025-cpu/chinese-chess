import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Lightbulb, Pause, Play, RotateCcw } from 'lucide-react';
import type { Piece, Position } from './types';
import { getValidMoves } from './gameLogic';
import { Board, at, coordinate, name, sideName } from './Board';
import { applyMove, givesCheckmate, mateInOneMoves, sameMove, toughestReply, type Move } from './puzzleEngine';
import { analyzePuzzle, buildPieces, puzzles, type Puzzle, type PuzzleAnalysis } from './puzzles';

type Tone = 'info' | 'error' | 'success' | 'hint';
type Phase = 'play' | 'opponent' | 'solved';

interface Session {
  pieces: Piece[];
  step: 0 | 1;              // 0：紅方第一步；1：黑方應手後，紅方第二步
  phase: Phase;
  selectedId: string | null;
  legal: Position[];
  marks: Position[];        // 上一手起訖格
  firstMove: Move | null;   // 兩步殺：玩家走的第一步
  hintLevel: 0 | 1 | 2 | 3;
  feedback: { tone: Tone; text: string };
}

const OPPONENT_DELAY = 650;
const REPLAY_DELAY = 1000;

const fresh = (puzzle: Puzzle): Session => ({
  pieces: buildPieces(puzzle), step: 0, phase: 'play', selectedId: null, legal: [], marks: [],
  firstMove: null, hintLevel: 0,
  feedback: { tone: 'info', text: '紅方先走，' + (puzzle.mateIn === 1 ? '一步將死黑方。' : '兩步將死黑方。') },
});

const pieceAtMove = (pieces: Piece[], move: Move) => pieces.find(piece => at(piece, move.from.row, move.from.col));
const describe = (pieces: Piece[], move: Move) => {
  const piece = pieceAtMove(pieces, move);
  return (piece ? sideName[piece.color] + name(piece) + ' ' : '') + coordinate(move.from) + ' → ' + coordinate(move.to);
};

// 對方應手：玩家走主解第一步時沿用主解的應手；否則取引擎判定最頑強的應手。
function chooseReply(puzzle: Puzzle, analysis: PuzzleAnalysis, firstMove: Move): Move | null {
  if (sameMove(firstMove, puzzle.solution[0])) return puzzle.solution[1];
  const line = analysis.lines.find(item => sameMove(item.first, firstMove));
  return line ? toughestReply(line) : null;
}

export default function PuzzleMode({ active }: { active: boolean }) {
  const [index, setIndex] = useState(0);
  const [session, setSession] = useState(() => fresh(puzzles[0]));
  const [solved, setSolved] = useState<string[]>([]);
  const [replay, setReplay] = useState<{ step: number; auto: boolean } | null>(null);

  const puzzle = puzzles[index];
  const analysis = useMemo(() => analyzePuzzle(puzzle), [puzzle]);
  const timeline = useMemo(() => puzzle.solution.reduce<Piece[][]>(
    (list, move) => [...list, applyMove(list[list.length - 1], move)], [buildPieces(puzzle)]), [puzzle]);
  const total = puzzle.solution.length;

  // 兩步殺：黑方自動應手
  useEffect(() => {
    if (session.phase !== 'opponent' || !session.firstMove) return;
    const firstMove = session.firstMove;
    const timer = setTimeout(() => {
      const reply = chooseReply(puzzle, analysis, firstMove);
      setSession(current => {
        if (current.phase !== 'opponent' || !reply) return current;
        return {
          ...current, pieces: applyMove(current.pieces, reply), step: 1, phase: 'play', hintLevel: 0,
          marks: [reply.from, reply.to],
          feedback: { tone: 'info', text: '黑方應手：' + describe(current.pieces, reply) + '。紅方再走一步，將死黑方。' },
        };
      });
    }, OPPONENT_DELAY);
    return () => clearTimeout(timer);
  }, [session.phase, session.firstMove, puzzle, analysis]);

  // 解答重播：自動前進
  useEffect(() => {
    if (!replay?.auto) return;
    if (replay.step >= total) { setReplay({ step: replay.step, auto: false }); return; }
    const timer = setTimeout(() => setReplay({ step: replay.step + 1, auto: true }), REPLAY_DELAY);
    return () => clearTimeout(timer);
  }, [replay, total]);

  function choose(next: number) {
    setIndex(next);
    setSession(fresh(puzzles[next]));
    setReplay(null);
  }

  function restart() {
    setSession(fresh(puzzle));
    setReplay(null);
  }

  function play(row: number, col: number) {
    if (session.phase !== 'play' || replay) return;
    const { pieces, legal, selectedId } = session;
    const target = pieces.find(piece => at(piece, row, col));
    if (target?.color === 'red') {
      setSession({ ...session, selectedId: target.id, legal: getValidMoves(target, pieces) });
      return;
    }
    const mover = pieces.find(piece => piece.id === selectedId);
    if (!mover || !legal.some(move => at(move, row, col))) {
      setSession({ ...session, selectedId: null, legal: [] });
      return;
    }

    const move: Move = { from: { row: mover.row, col: mover.col }, to: { row, col } };
    const after = applyMove(pieces, move);
    const needsMate = puzzle.mateIn === 1 || session.step === 1;
    const correct = needsMate ? givesCheckmate(after, 'black') : analysis.firstMoves.some(item => sameMove(item, move));

    if (!correct) {
      setSession({
        ...session, selectedId: null, legal: [],
        feedback: { tone: 'error', text: session.step === 0 ? puzzle.retry : '這一步還沒將死——再看看黑將還剩哪些出路。' },
      });
      return;
    }

    if (!needsMate) {
      setSession({
        ...session, pieces: after, phase: 'opponent', selectedId: null, legal: [], hintLevel: 0,
        marks: [move.from, move.to], firstMove: move,
        feedback: { tone: 'info', text: '這步正確，黑方正在應手…' },
      });
      return;
    }

    const main = puzzle.mateIn === 1
      ? sameMove(move, puzzle.solution[0])
      : !!session.firstMove && sameMove(session.firstMove, puzzle.solution[0]) && sameMove(move, puzzle.solution[2]);
    setSolved(list => (list.includes(puzzle.id) ? list : [...list, puzzle.id]));
    setSession({
      ...session, pieces: after, phase: 'solved', selectedId: null, legal: [], marks: [move.from, move.to],
      feedback: { tone: 'success', text: main ? '將死！過關。' : '將死！這是另一種正解，同樣過關。' },
    });
  }

  // 提示：依序顯示文字提示 → 標出要動的棋子 → 標出目標格
  const hintMove: Move | undefined = session.phase !== 'play' ? undefined
    : session.step === 0 ? puzzle.solution[0] : mateInOneMoves(session.pieces, 'red')[0];

  function hint() {
    if (session.phase !== 'play' || replay) return;
    const level = Math.min(session.hintLevel + 1, 3) as 1 | 2 | 3;
    const text = level === 1 ? (session.step === 1 && puzzle.hintSecond ? puzzle.hintSecond : puzzle.hint)
      : level === 2 ? '金框標出的是這一步該移動的棋子。' : '金框標出了這一步的目標位置。';
    setSession({ ...session, hintLevel: level, selectedId: null, legal: [], feedback: { tone: 'hint', text } });
  }

  const hintSquares = !hintMove || session.hintLevel < 2 ? []
    : session.hintLevel === 2 ? [hintMove.from] : [hintMove.from, hintMove.to];

  // 顯示內容：重播時顯示主解的盤面
  const replaying = replay !== null;
  const shownPieces = replaying ? timeline[replay.step] : session.pieces;
  const replayMove = replaying && replay.step > 0 ? puzzle.solution[replay.step - 1] : null;
  const marks = replayMove ? [replayMove.from, replayMove.to] : replaying ? [] : session.marks;
  const feedback = replaying
    ? { tone: 'info' as Tone, text: replay.step === 0 ? '解答重播 · 初始盤面（主解共 ' + total + ' 步）'
      : '解答重播 · 第 ' + replay.step + ' / ' + total + ' 步：' + describe(timeline[replay.step - 1], puzzle.solution[replay.step - 1]) +
        (replay.step === total ? '，將死。' : '。') }
    : session.feedback;
  const isSolved = solved.includes(puzzle.id);

  return <main className="layout puzzle-layout" hidden={!active}>
    <section className="table" aria-label="殘局挑戰">
      <div className="puzzle-picker" role="group" aria-label="選擇題目">
        {puzzles.map((item, position) => <button type="button" key={item.id}
          className={'chip' + (position === index ? ' current' : '')}
          aria-current={position === index ? 'true' : undefined}
          aria-label={'第 ' + (position + 1) + ' 題 ' + item.title + (solved.includes(item.id) ? '（已過關）' : '')}
          onClick={() => choose(position)}>
          {position + 1}{solved.includes(item.id) && <Check size={14} aria-hidden="true" />}
        </button>)}
      </div>

      <p className={'feedback ' + feedback.tone} role="status">{feedback.text}</p>

      <Board pieces={shownPieces}
        selectedId={replaying ? null : session.selectedId}
        legal={replaying ? [] : session.legal}
        marks={marks} hints={replaying ? [] : hintSquares}
        disabled={replaying || session.phase !== 'play'}
        onSquare={play} />

      {replaying ? <div className="actions replay-actions">
        <button className="control" aria-label="上一步" disabled={replay.step === 0}
          onClick={() => setReplay({ step: replay.step - 1, auto: false })}><ChevronLeft size={18} aria-hidden="true" /></button>
        <button className="control" onClick={() => setReplay(replay.auto ? { ...replay, auto: false }
          : { step: replay.step >= total ? 0 : replay.step, auto: true })}>
          {replay.auto ? <><Pause size={16} aria-hidden="true" /> 暫停</> : <><Play size={16} aria-hidden="true" /> 播放</>}
        </button>
        <button className="control" aria-label="下一步" disabled={replay.step >= total}
          onClick={() => setReplay({ step: replay.step + 1, auto: false })}><ChevronRight size={18} aria-hidden="true" /></button>
        <button className="control return" onClick={() => setReplay(null)}>結束重播</button>
      </div> : <div className="actions">
        <button className="control" onClick={hint} disabled={session.phase !== 'play'}>
          <Lightbulb size={16} aria-hidden="true" /> 提示{session.hintLevel > 0 && ' ' + session.hintLevel + '/3'}
        </button>
        <button className="control" onClick={restart}><RotateCcw size={16} aria-hidden="true" /> 重新挑戰</button>
        <button className="control" onClick={() => setReplay({ step: 0, auto: true })}><Play size={16} aria-hidden="true" /> 解答重播</button>
        {session.phase === 'solved' && index < puzzles.length - 1 &&
          <button className="control primary" onClick={() => choose(index + 1)}>下一題 <ChevronRight size={16} aria-hidden="true" /></button>}
      </div>}
    </section>

    <aside className="sidebar" aria-label="題目說明">
      <section className="panel puzzle-info">
        <div className="journal-heading">
          <h2>第 {index + 1} 題・{puzzle.title}</h2>
          <span className="badge">{puzzle.mateIn === 1 ? '一步殺' : '兩步殺'}</span>
        </div>
        <p className="goal">{puzzle.goal}</p>
        <p className="muted note">
          {puzzle.mateIn === 2 ? '兩步殺：紅走第一步、黑方應手、紅走第二步將死。' : '一步殺：紅方走一步就將死黑方。'}
          若有多個正解，都會被接受。{isSolved && ' 本題已過關。'}
        </p>
      </section>
      <section className="panel puzzle-guide">
        <h2>操作說明</h2>
        <ul className="muted">
          <li>點選紅子後，圓點為可走位置，紅圈為可吃子。</li>
          <li>走錯可直接重試，盤面不會改變。</li>
          <li>「提示」最多三階段，「解答重播」不會影響你的作答。</li>
        </ul>
      </section>
    </aside>
  </main>;
}
