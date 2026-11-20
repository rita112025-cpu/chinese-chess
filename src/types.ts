export type PieceColor = 'red' | 'black';

export type PieceType = 'king' | 'advisor' | 'elephant' | 'horse' | 'rook' | 'cannon' | 'pawn';

export interface Piece {
  id: string;
  type: PieceType;
  color: PieceColor;
  row: number;
  col: number;
}

export interface Position {
  row: number;
  col: number;
}

export interface GameState {
  pieces: Piece[];
  currentTurn: PieceColor;
  selectedPiece: Piece | null;
  validMoves: Position[];
  gameOver: boolean;
  winner: PieceColor | null;
  inCheck: PieceColor | null;
  moveHistory: { piece: Piece; from: Position; to: Position; captured?: Piece }[];
}
