import type { Piece, PieceColor, Position } from './types';
import { getPieceName } from './gameLogic';

// 對弈模式與殘局挑戰共用的棋盤與顯示用小工具。

export const sideName = { red: '紅方', black: '黑方' };
const files = '一二三四五六七八九';
export const squares = Array.from({ length: 90 }, (_, index) => ({
  row: Math.floor(index / 9), col: index % 9,
}));
export const at = (position: Position, row: number, col: number) =>
  position.row === row && position.col === col;
export const name = (piece: Piece) => getPieceName(piece.type, piece.color);
export const coordinate = ({ row, col }: Position) => files[8 - col] + '・' + (10 - row);
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

interface BoardProps {
  pieces: Piece[];
  selectedId?: string | null;
  checkedColor?: PieceColor | null;
  legal?: Position[];
  // 上一手的起訖格（淡色標示）
  marks?: Position[];
  // 提示格（金色外框）
  hints?: Position[];
  disabled?: boolean;
  onSquare: (row: number, col: number) => void;
}

export function Board({
  pieces, selectedId = null, checkedColor = null, legal = [], marks = [], hints = [],
  disabled = false, onSquare,
}: BoardProps) {
  return <div className="frame">
    <div className="board" aria-label="象棋棋盤">
      <BoardLines />
      {pieces.map(piece => <span aria-hidden="true" key={piece.id} style={place(piece)}
        className={'piece ' + piece.color +
          (selectedId === piece.id ? ' selected' : '') +
          (checkedColor === piece.color && piece.type === 'king' ? ' checked' : '')}>
        {name(piece)}
      </span>)}
      {squares.map(({ row, col }) => {
        const piece = pieces.find(item => at(item, row, col));
        const isLegal = legal.some(move => at(move, row, col));
        const previous = marks.some(mark => at(mark, row, col));
        const hinted = hints.some(hint => at(hint, row, col));
        const selected = !!piece && selectedId === piece.id;
        return <button type="button" key={row * 9 + col} style={place({row, col})}
          disabled={disabled}
          aria-pressed={selected}
          aria-label={coordinate({row, col}) + (piece ? ' ' + sideName[piece.color] + name(piece) : ' 空位') + (isLegal ? ' 可走' : '') + (hinted ? ' 提示' : '')}
          className={'square' + (isLegal ? (piece ? ' capture' : ' legal') : '') + (previous ? ' previous' : '') + (hinted ? ' hinted' : '')}
          onClick={() => onSquare(row, col)} />;
      })}
    </div>
  </div>;
}
