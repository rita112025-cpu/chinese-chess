import { useRef, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import type { GameState, Piece, Position } from './types';
import { initializePieces, getPieceName, getValidMoves, isKingInCheck, isCheckmate } from './gameLogic';

const initialState = (): GameState => ({
  pieces: initializePieces(), currentTurn: 'red', selectedPiece: null,
  validMoves: [], gameOver: false, winner: null, inCheck: null, moveHistory: [],
});

const sideName = { red: '紅方', black: '黑方' };
const files = '一二三四五六七八九';
const squares = Array.from({ length: 90 }, (_, index) => ({
  row: Math.floor(index / 9), col: index % 9,
}));
const at = (position: Position, row: number, col: number) =>
  position.row === row && position.col === col;
const name = (piece: Piece) => getPieceName(piece.type, piece.color);
const coordinate = ({ row, col }: Position) => files[8 - col] + '・' + (10 - row);
const place = ({ row, col }: Position) => ({
  left: ((30 + 56 * col) / 508 * 100) + '%',
  top: ((30 + 56 * row) / 564 * 100) + '%',
});

function BoardLines() {
  const lines = [
    ...Array.from({length: 10}, (_, row) => 'M30 ' + (30 + 56 * row) + 'h448'),
    ...Array.from({length: 7}, (_, index) => {
      const x = 86 + 56 * index;
      return 'M' + x + ' 30v224 M' + x + ' 310v224';
    }),
    'M30 30v504 M478 30v504 M198 30l112 112 M310 30l-112 112',
    'M198 422l112 112 M310 422l-112 112',
  ];
  return <svg className="board-lines" viewBox="0 0 508 564" aria-hidden="true">
    <rect x="24" y="24" width="460" height="516" fill="none" strokeWidth="0.65" />
    <path d={lines.join(' ')} fill="none" strokeWidth="1.2" />
    <path className="river" d="M31 255H477V309H31Z" />
    <text x="139" y="293">楚 河</text>
    <text x="370" y="293">漢 界</text>
  </svg>;
}

function App() {
  const [game, setGame] = useState(initialState);
  const [replay, setReplay] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const count = game.moveHistory.length;
  const steps = replay ?? count;
  const last = game.moveHistory[steps - 1];
  const visiblePieces = replay === null ? game.pieces : game.moveHistory.slice(0, replay).reduce(
    (pieces, move) => pieces.filter(piece => piece.id !== move.captured?.id)
      .map(piece => piece.id === move.piece.id ? { ...piece, ...move.to } : piece),
    initializePieces(),
  );
  const activeSide = game.winner ?? game.currentTurn;
  const status = game.winner ? sideName[game.winner] + '獲勝'
    : game.inCheck ? sideName[game.currentTurn] + '走棋 · 將軍'
    : '輪到' + sideName[game.currentTurn];

  function play(row: number, col: number) {
    if (replay !== null) return;
    setGame(current => {
      if (current.gameOver) return current;
      const { pieces, currentTurn, selectedPiece, validMoves } = current;
      const target = pieces.find(piece => at(piece, row, col));
      if (target?.color === currentTurn) {
        return { ...current, selectedPiece: target, validMoves: getValidMoves(target, pieces) };
      }
      if (!selectedPiece || !validMoves.some(move => at(move, row, col))) {
        return { ...current, selectedPiece: null, validMoves: [] };
      }
      const to = { row, col };
      const nextPieces = pieces.filter(piece => piece.id !== target?.id)
        .map(piece => piece.id === selectedPiece.id ? { ...piece, ...to } : piece);
      const capturedKing = target?.type === 'king';
      const nextSide = currentTurn === 'red' ? 'black' : 'red';
      const won = capturedKing || isCheckmate(nextPieces, nextSide);
      return {
        pieces: nextPieces, currentTurn: capturedKing ? currentTurn : nextSide,
        selectedPiece: null, validMoves: [], gameOver: won, winner: won ? currentTurn : null,
        inCheck: !capturedKing && isKingInCheck(nextPieces, nextSide) ? nextSide : null,
        moveHistory: [...current.moveHistory, { piece: selectedPiece, from: selectedPiece, to, captured: target }],
      };
    });
  }

  function reset() {
    setGame(initialState());
    setReplay(null);
    dialog.current?.close();
  }

  return <div className="shell">
    <header className="masthead">
      <div className="identity"><span className="seal" aria-hidden="true">弈</span>
        <div><h1>墨影棋院</h1><p>中國象棋</p></div>
      </div>
      <span className="mode">同機雙人對弈</span>
    </header>

    <main className="layout">
      <section className="table" aria-label="對局">
        <div className="table-heading">
          <div className="live-status" role="status">
            <span className={'side-dot ' + activeSide} aria-hidden="true" />
            {replay === null ? status : steps === 0 ? '回放 · 初始盤面' : '回放 · 第 ' + steps + ' 手'}
          </div>
          <button className="control reset" onClick={() => count ? dialog.current?.showModal() : reset()}>
            <RotateCcw size={16} aria-hidden="true" /> 新局
          </button>
        </div>
        <div className="frame">
          <div className="board" aria-label="象棋棋盤">
            <BoardLines />
            {visiblePieces.map(piece => <span aria-hidden="true" key={piece.id} style={place(piece)}
              className={'piece ' + piece.color +
                (replay === null && game.selectedPiece?.id === piece.id ? ' selected' : '') +
                (replay === null && game.inCheck === piece.color && piece.type === 'king' ? ' checked' : '')}>
              {name(piece)}
            </span>)}
            {squares.map(({ row, col }) => {
              const piece = visiblePieces.find(item => at(item, row, col));
              const legal = replay === null && game.validMoves.some(move => at(move, row, col));
              const previous = last && (at(last.from, row, col) || at(last.to, row, col));
              const selected = replay === null && !!piece && game.selectedPiece?.id === piece.id;
              return <button type="button" key={row * 9 + col} style={place({row, col})}
                disabled={replay !== null || game.gameOver}
                aria-pressed={selected}
                aria-label={coordinate({row, col}) + (piece ? ' ' + sideName[piece.color] + name(piece) : ' 空位') + (legal ? ' 可走' : '')}
                className={'square' + (legal ? (piece ? ' capture' : ' legal') : '') + (previous ? ' previous' : '')}
                onClick={() => play(row, col)} />;
            })}
          </div>
        </div>
        <p className="board-guide"><span className="hint-dot" /> 可走位置 <span className="hint-ring" /> 可吃子</p>
      </section>

      <aside className="sidebar" aria-label="棋譜與吃子">
        <section className="panel captures">
          <h2>吃子</h2>
          {(['red', 'black'] as const).map(side => {
            const taken = game.moveHistory.slice(0, steps).filter(move => move.piece.color === side && move.captured);
            return <div className="capture-row" key={side}>
              <span><i className={'side-dot ' + side} />{sideName[side]}</span>
              <div className="tokens">{taken.length ? taken.map(({ captured }) =>
                captured && <span className={'token ' + captured.color} key={captured.id}>{name(captured)}</span>
              ) : <span className="muted">尚未吃子</span>}</div>
            </div>;
          })}
        </section>
        <section className="panel journal">
          <div className="journal-heading"><h2><BookOpen size={19} aria-hidden="true" /> 對局棋譜</h2><span>{count} 手</span></div>
          {count ? <ol className="moves">{game.moveHistory.map((move, index) =>
            <li key={index}><button type="button" aria-current={steps === index + 1 ? 'step' : undefined}
              onClick={() => setReplay(index + 1)}>
              <span className="move-index">{index + 1}</span>
              <span className={'token ' + move.piece.color}>{name(move.piece)}</span>
              <span>{coordinate(move.from)} → {coordinate(move.to)}</span>
              {move.captured && <span className="taken">吃{name(move.captured)}</span>}
            </button></li>
          ).reverse()}</ol> : <p className="empty">落子後，棋譜會顯示在這裡。</p>}
          <div className="replay-controls">
            <button className="control" aria-label="回放上一步" disabled={steps === 0} onClick={() => setReplay(steps - 1)}><ChevronLeft size={18} /></button>
            <button className="control" aria-label="回放下一步" disabled={steps === count} onClick={() => setReplay(steps + 1)}><ChevronRight size={18} /></button>
            <button className="control return" disabled={replay === null} onClick={() => setReplay(null)}>回到現局</button>
          </div>
        </section>
      </aside>
    </main>

    <dialog ref={dialog} aria-labelledby="reset-title">
      <h2 id="reset-title">重新開局？</h2>
      <p>目前的盤面與棋譜將會清除。</p>
      <div className="dialog-controls">
        <button className="control" autoFocus onClick={() => dialog.current?.close()}>繼續對局</button>
        <button className="control primary" onClick={reset}>開始新局</button>
      </div>
    </dialog>
  </div>;
}

export default App;
