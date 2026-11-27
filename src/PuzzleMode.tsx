import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Dices, Lightbulb, Pause, Play, RotateCcw } from 'lucide-react';
import type { Piece, Position } from './types';
import { getValidMoves } from './gameLogic';
import { Board, at, coordinate, name, sideName } from './Board';
import { applyMove, givesCheckmate, sameMove, type Move } from './puzzleEngine';
import { buildPieces, puzzles, stepLabel, type Puzzle } from './puzzles';
import { EngineClient } from './engineClient';
import type { ReplyMode } from './engineCore';

type Tone = 'info' | 'error' | 'success' | 'hint';
type Phase = 'analyzing' | 'play' | 'opponent' | 'solved';
type Filter = 'all' | 1 | 2 | 3 | 'random';
type Steps = 1 | 2 | 3;

interface Session {
  job: number;              // 每次需要非同步運算時遞增，用來丟棄過期結果
  pieces: Piece[];
  history: Move[];          // 本次作答的全部走法（紅、黑交錯）
  redMoves: number;         // 紅方已走步數
  phase: Phase;
  solutions: Move[] | null; // 目前局面下被接受的紅方走法（由規則引擎計算）
  selectedId: string | null;
  legal: Position[];
  marks: Position[];
  hintLevel: 0 | 1 | 2 | 3;
  feedback: { tone: Tone; text: string };
}

const OPPONENT_DELAY = 650;
const REPLAY_DELAY = 1000;
const numerals = ['', '一', '兩', '三'];
let jobs = 0;

const fresh = (puzzle: Puzzle): Session => ({
  job: ++jobs, pieces: buildPieces(puzzle), history: [], redMoves: 0, phase: 'analyzing', solutions: null,
  selectedId: null, legal: [], marks: [], hintLevel: 0,
  feedback: { tone: 'info', text: '紅方先走，' + numerals[puzzle.mateIn] + '步將死黑方。' },
});

const describe = (pieces: Piece[], move: Move) => {
  const piece = pieces.find(item => at(item, move.from.row, move.from.col));
  return (piece ? sideName[piece.color] + name(piece) + ' ' : '') + coordinate(move.from) + ' → ' + coordinate(move.to);
};

// 目前的作答是否仍與主解完全一致
const onMainLine = (history: Move[], solution: Move[]) =>
  history.length < solution.length && history.every((move, i) => sameMove(move, solution[i]));

const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: '全部' }, { value: 1, label: '一步殺' }, { value: 2, label: '兩步殺' },
  { value: 3, label: '三步殺' }, { value: 'random', label: '隨機出題' },
];

export default function PuzzleMode({ active }: { active: boolean }) {
  const engine = useRef<EngineClient>();
  const generator = useRef<EngineClient>();
  engine.current ??= new EngineClient();
  generator.current ??= new EngineClient();

  const [filter, setFilter] = useState<Filter>('all');
  const [puzzle, setPuzzle] = useState<Puzzle>(puzzles[0]);
  const [session, setSession] = useState(() => fresh(puzzles[0]));
  const [solved, setSolved] = useState<string[]>([]);
  const [replay, setReplay] = useState<{ step: number; auto: boolean } | null>(null);
  const [replyMode, setReplyMode] = useState<ReplyMode>('random');
  const [genSteps, setGenSteps] = useState<Steps>(1);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  const timeline = useMemo(() => puzzle.solution.reduce<Piece[][]>(
    (list, move) => [...list, applyMove(list[list.length - 1], move)], [buildPieces(puzzle)]), [puzzle]);
  const total = puzzle.solution.length;
  const remaining = puzzle.mateIn - session.redMoves;

  useEffect(() => () => { engine.current?.reset(); generator.current?.reset(); }, []);

  // 輪到紅方：請引擎算出所有被接受的走法
  useEffect(() => {
    if (session.phase !== 'analyzing') return;
    const { job, pieces } = session;
    engine.current!.run<Move[]>({ type: 'solutions', pieces, remaining })
      .then(solutions => setSession(current => current.job !== job ? current : {
        ...current, phase: 'play', solutions,
      }))
      .catch(() => undefined);
  }, [session.phase, session.job]);

  // 黑方應手
  useEffect(() => {
    if (session.phase !== 'opponent') return;
    const { job, pieces, history } = session;
    const preferred = onMainLine(history, puzzle.solution) ? puzzle.solution[history.length] : null;
    const timer = setTimeout(() => {
      engine.current!.run<Move | null>({
        type: 'reply', pieces, remaining, mode: replyMode, preferred, random: Math.random(),
      }).then(reply => setSession(current => {
        if (current.job !== job) return current;
        if (!reply) return { ...current, phase: 'play', feedback: { tone: 'error', text: '引擎找不到黑方應手，請按「重新挑戰」。' } };
        return {
          ...current, job: ++jobs, pieces: applyMove(current.pieces, reply), history: [...current.history, reply],
          phase: 'analyzing', solutions: null, hintLevel: 0, marks: [reply.from, reply.to],
          feedback: {
            tone: 'info',
            text: '黑方應手：' + describe(current.pieces, reply) + '。還剩 ' + remaining + ' 步，繼續將死黑方。',
          },
        };
      })).catch(() => undefined);
    }, OPPONENT_DELAY);
    return () => clearTimeout(timer);
  }, [session.phase, session.job]);

  // 解答重播：自動前進
  useEffect(() => {
    if (!replay?.auto) return;
    if (replay.step >= total) { setReplay({ step: replay.step, auto: false }); return; }
    const timer = setTimeout(() => setReplay({ step: replay.step + 1, auto: true }), REPLAY_DELAY);
    return () => clearTimeout(timer);
  }, [replay, total]);

  function open(next: Puzzle) {
    setPuzzle(next);
    setSession(fresh(next));
    setReplay(null);
  }

  function restart() {
    setSession(fresh(puzzle));
    setReplay(null);
  }

  function generate() {
    generator.current!.reset();
    setGenerating(true);
    setGenError('');
    const seed = Math.floor(Math.random() * 1e9);
    generator.current!.run<Puzzle>({ type: 'generate', seed, mateIn: genSteps })
      .then(next => { setGenerating(false); open(next); })
      .catch((error: Error) => {
        setGenerating(false);
        if (error.message !== '已取消') setGenError('產生失敗：' + error.message);
      });
  }

  function cancelGenerate() {
    generator.current!.reset();
    setGenerating(false);
  }

  function play(row: number, col: number) {
    if (replay || (session.phase !== 'play' && session.phase !== 'analyzing')) return;
    const { pieces, legal, selectedId, solutions } = session;
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
    if (!solutions) {
      setSession({ ...session, feedback: { tone: 'info', text: '規則引擎分析中，請稍候再走。' } });
      return;
    }

    const move: Move = { from: { row: mover.row, col: mover.col }, to: { row, col } };
    if (!solutions.some(item => sameMove(item, move))) {
      setSession({
        ...session, selectedId: null, legal: [],
        feedback: {
          tone: 'error',
          text: session.redMoves === 0 ? puzzle.retry : '這一步沒有保證將死——再看看黑將還剩哪些出路。',
        },
      });
      return;
    }

    const after = applyMove(pieces, move);
    const history = [...session.history, move];
    if (givesCheckmate(after, 'black')) {
      const main = history.length === total && history.every((item, i) => sameMove(item, puzzle.solution[i]));
      const early = session.redMoves + 1 < puzzle.mateIn;
      setSolved(list => (list.includes(puzzle.id) ? list : [...list, puzzle.id]));
      setSession({
        ...session, pieces: after, history, redMoves: session.redMoves + 1, phase: 'solved',
        selectedId: null, legal: [], marks: [move.from, move.to],
        feedback: {
          tone: 'success',
          text: main ? '將死！過關。' : early ? '將死！比預定步數更快，同樣過關。' : '將死！這是另一種正解，同樣過關。',
        },
      });
      return;
    }
    setSession({
      ...session, job: ++jobs, pieces: after, history, redMoves: session.redMoves + 1, phase: 'opponent',
      solutions: null, selectedId: null, legal: [], hintLevel: 0, marks: [move.from, move.to],
      feedback: { tone: 'info', text: '這步正確，黑方正在應手…' },
    });
  }

  // 提示：文字 → 標出要動的棋子 → 標出目標格
  const hintMove: Move | undefined = session.phase !== 'play' ? undefined
    : onMainLine(session.history, puzzle.solution) ? puzzle.solution[session.history.length]
    : session.solutions?.[0];

  function hint() {
    if (session.phase !== 'play' || replay) return;
    const level = Math.min(session.hintLevel + 1, 3) as 1 | 2 | 3;
    const text = level === 1 ? puzzle.hints[Math.min(session.redMoves, puzzle.hints.length - 1)]
      : level === 2 ? '金框標出的是這一步該移動的棋子。' : '金框標出了這一步的目標位置。';
    setSession({ ...session, hintLevel: level, selectedId: null, legal: [], feedback: { tone: 'hint', text } });
  }

  const hintSquares = !hintMove || session.hintLevel < 2 ? []
    : session.hintLevel === 2 ? [hintMove.from] : [hintMove.from, hintMove.to];

  const replaying = replay !== null;
  const shownPieces = replaying ? timeline[replay.step] : session.pieces;
  const replayMove = replaying && replay.step > 0 ? puzzle.solution[replay.step - 1] : null;
  const marks = replayMove ? [replayMove.from, replayMove.to] : replaying ? [] : session.marks;
  const feedback = replaying
    ? { tone: 'info' as Tone, text: replay.step === 0 ? '解答重播 · 初始盤面（主解共 ' + total + ' 手）'
      : '解答重播 · 第 ' + replay.step + ' / ' + total + ' 手：' + describe(timeline[replay.step - 1], puzzle.solution[replay.step - 1]) +
        (replay.step === total ? '，將死。' : '。') }
    : session.feedback;
  const isSolved = solved.includes(puzzle.id);
  const visible = puzzles.map((item, position) => ({ item, position }))
    .filter(({ item }) => filter === 'all' || filter === 'random' || item.mateIn === filter);
  const randomSolved = solved.filter(id => !puzzles.some(item => item.id === id)).length;
  const busy = session.phase === 'analyzing' || session.phase === 'opponent';

  return <main className="layout puzzle-layout" hidden={!active}>
    <section className="table" aria-label="殘局挑戰">
      <div className="filters" role="group" aria-label="題型">
        {filters.map(({ value, label }) => <button type="button" key={String(value)} className="tab"
          aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
      </div>

      {filter === 'random' ? <div className="generator">
        <div className="segmented" role="group" aria-label="隨機題步數">
          {([1, 2, 3] as const).map(n => <button type="button" key={n} className="tab" aria-pressed={genSteps === n}
            disabled={generating} onClick={() => setGenSteps(n)}>{stepLabel(n)}</button>)}
        </div>
        {generating
          ? <button className="control" onClick={cancelGenerate}>取消</button>
          : <button className="control primary" onClick={generate}><Dices size={16} aria-hidden="true" /> 產生新題</button>}
        <p className="muted gen-note">
          {generating ? '正在產生並驗證題目' + (genSteps === 3 ? '（三步殺可能需要較久）' : '') + '…'
            : genError || '已過關隨機題：' + randomSolved + ' 題'}
        </p>
      </div> : <div className="puzzle-picker" role="group" aria-label="選擇題目">
        {visible.map(({ item, position }) => <button type="button" key={item.id}
          className={'chip steps-' + item.mateIn + (item.id === puzzle.id ? ' current' : '')}
          aria-current={item.id === puzzle.id ? 'true' : undefined}
          aria-label={'第 ' + (position + 1) + ' 題 ' + item.title + '，' + stepLabel(item.mateIn) + (solved.includes(item.id) ? '（已過關）' : '')}
          title={item.title + '・' + stepLabel(item.mateIn)}
          onClick={() => open(item)}>
          {position + 1}{solved.includes(item.id) && <Check size={14} aria-hidden="true" />}
        </button>)}
      </div>}

      {filter !== 'random' && <p className="picker-legend" aria-hidden="true">
        <span><i style={{ background: '#7dc59a' }} />一步殺</span>
        <span><i style={{ background: '#dbc18a' }} />兩步殺</span>
        <span><i style={{ background: '#e17e6c' }} />三步殺</span>
      </p>}

      <p className={'feedback ' + feedback.tone} role="status">{feedback.text}</p>

      <Board pieces={shownPieces}
        selectedId={replaying ? null : session.selectedId}
        legal={replaying ? [] : session.legal}
        marks={marks} hints={replaying ? [] : hintSquares}
        disabled={replaying || session.phase === 'opponent' || session.phase === 'solved'}
        onSquare={play} />

      {replaying ? <div className="actions replay-actions">
        <button className="control" aria-label="上一手" disabled={replay.step === 0}
          onClick={() => setReplay({ step: replay.step - 1, auto: false })}><ChevronLeft size={18} aria-hidden="true" /></button>
        <button className="control" onClick={() => setReplay(replay.auto ? { ...replay, auto: false }
          : { step: replay.step >= total ? 0 : replay.step, auto: true })}>
          {replay.auto ? <><Pause size={16} aria-hidden="true" /> 暫停</> : <><Play size={16} aria-hidden="true" /> 播放</>}
        </button>
        <button className="control" aria-label="下一手" disabled={replay.step >= total}
          onClick={() => setReplay({ step: replay.step + 1, auto: false })}><ChevronRight size={18} aria-hidden="true" /></button>
        <button className="control return" onClick={() => setReplay(null)}>結束重播</button>
      </div> : <div className="actions">
        <button className="control" onClick={hint} disabled={session.phase !== 'play'}>
          <Lightbulb size={16} aria-hidden="true" /> 提示{session.hintLevel > 0 && ' ' + session.hintLevel + '/3'}
        </button>
        <button className="control" onClick={restart}><RotateCcw size={16} aria-hidden="true" /> 重新挑戰</button>
        <button className="control" onClick={() => setReplay({ step: 0, auto: true })}><Play size={16} aria-hidden="true" /> 解答重播</button>
        {session.phase === 'solved' && puzzle.seed === undefined && puzzles.indexOf(puzzle) < puzzles.length - 1 &&
          <button className="control primary" onClick={() => open(puzzles[puzzles.indexOf(puzzle) + 1])}>下一題 <ChevronRight size={16} aria-hidden="true" /></button>}
        {session.phase === 'solved' && puzzle.seed !== undefined &&
          <button className="control primary" onClick={generate} disabled={generating}><Dices size={16} aria-hidden="true" /> 再來一題</button>}
      </div>}
    </section>

    <aside className="sidebar" aria-label="題目說明">
      <section className="panel puzzle-info">
        <div className="journal-heading">
          <h2>{puzzle.seed === undefined ? '第 ' + (puzzles.indexOf(puzzle) + 1) + ' 題・' : ''}{puzzle.title}</h2>
          <span className="badge">{stepLabel(puzzle.mateIn)}</span>
        </div>
        <p className="goal">{puzzle.goal}</p>
        <p className="muted note">
          {puzzle.mateIn === 1 ? '紅方走一步就將死黑方。' : '紅黑交替走，紅方在第 ' + puzzle.mateIn + ' 步將死黑方；黑方的每一種合法應手都已由規則引擎驗證。'}
          若有多個正解，都會被接受。{isSolved && ' 本題已過關。'}
        </p>
        {puzzle.mateIn > 1 && <p className="muted note">進度：紅方第 {Math.min(session.redMoves + (session.phase === 'solved' ? 0 : 1), puzzle.mateIn)} / {puzzle.mateIn} 步{busy ? '・' + (session.phase === 'opponent' ? '黑方思考中' : '引擎分析中') : ''}</p>}
      </section>
      <section className="panel">
        <h2>黑方應手</h2>
        <div className="segmented reply-mode" role="group" aria-label="黑方應手方式">
          <button type="button" className="tab" aria-pressed={replyMode === 'random'} onClick={() => setReplyMode('random')}>隨機</button>
          <button type="button" className="tab" aria-pressed={replyMode === 'toughest'} onClick={() => setReplyMode('toughest')}>最頑強</button>
        </div>
        <p className="muted note">
          {replyMode === 'random' ? '兩步殺、三步殺中，黑方會從所有合法應手中隨機挑一手，每次重玩可能看到不同變化。'
            : '黑方會選擇讓紅方正解最少的應手；走主解時沿用主解的應手。'}
        </p>
      </section>
      <section className="panel puzzle-guide">
        <h2>操作說明</h2>
        <ul className="muted">
          <li>點選紅子後，圓點為可走位置，紅圈為可吃子。</li>
          <li>走錯可直接重試，盤面不會改變。</li>
          <li>「提示」最多三階段，「解答重播」顯示主解，不會影響你的作答。</li>
        </ul>
      </section>
    </aside>
  </main>;
}
