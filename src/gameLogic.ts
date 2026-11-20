import { Piece, PieceColor, Position, PieceType } from './types';

// 初始化棋子
export function initializePieces(): Piece[] {
  const pieces: Piece[] = [];

  // 黑方 (上方, row 0-4)
  pieces.push({ id: 'b-king', type: 'king', color: 'black', row: 0, col: 4 });
  pieces.push({ id: 'b-advisor1', type: 'advisor', color: 'black', row: 0, col: 3 });
  pieces.push({ id: 'b-advisor2', type: 'advisor', color: 'black', row: 0, col: 5 });
  pieces.push({ id: 'b-elephant1', type: 'elephant', color: 'black', row: 0, col: 2 });
  pieces.push({ id: 'b-elephant2', type: 'elephant', color: 'black', row: 0, col: 6 });
  pieces.push({ id: 'b-horse1', type: 'horse', color: 'black', row: 0, col: 1 });
  pieces.push({ id: 'b-horse2', type: 'horse', color: 'black', row: 0, col: 7 });
  pieces.push({ id: 'b-rook1', type: 'rook', color: 'black', row: 0, col: 0 });
  pieces.push({ id: 'b-rook2', type: 'rook', color: 'black', row: 0, col: 8 });
  pieces.push({ id: 'b-cannon1', type: 'cannon', color: 'black', row: 2, col: 1 });
  pieces.push({ id: 'b-cannon2', type: 'cannon', color: 'black', row: 2, col: 7 });
  pieces.push({ id: 'b-pawn1', type: 'pawn', color: 'black', row: 3, col: 0 });
  pieces.push({ id: 'b-pawn2', type: 'pawn', color: 'black', row: 3, col: 2 });
  pieces.push({ id: 'b-pawn3', type: 'pawn', color: 'black', row: 3, col: 4 });
  pieces.push({ id: 'b-pawn4', type: 'pawn', color: 'black', row: 3, col: 6 });
  pieces.push({ id: 'b-pawn5', type: 'pawn', color: 'black', row: 3, col: 8 });

  // 紅方 (下方, row 5-9)
  pieces.push({ id: 'r-king', type: 'king', color: 'red', row: 9, col: 4 });
  pieces.push({ id: 'r-advisor1', type: 'advisor', color: 'red', row: 9, col: 3 });
  pieces.push({ id: 'r-advisor2', type: 'advisor', color: 'red', row: 9, col: 5 });
  pieces.push({ id: 'r-elephant1', type: 'elephant', color: 'red', row: 9, col: 2 });
  pieces.push({ id: 'r-elephant2', type: 'elephant', color: 'red', row: 9, col: 6 });
  pieces.push({ id: 'r-horse1', type: 'horse', color: 'red', row: 9, col: 1 });
  pieces.push({ id: 'r-horse2', type: 'horse', color: 'red', row: 9, col: 7 });
  pieces.push({ id: 'r-rook1', type: 'rook', color: 'red', row: 9, col: 0 });
  pieces.push({ id: 'r-rook2', type: 'rook', color: 'red', row: 9, col: 8 });
  pieces.push({ id: 'r-cannon1', type: 'cannon', color: 'red', row: 7, col: 1 });
  pieces.push({ id: 'r-cannon2', type: 'cannon', color: 'red', row: 7, col: 7 });
  pieces.push({ id: 'r-pawn1', type: 'pawn', color: 'red', row: 6, col: 0 });
  pieces.push({ id: 'r-pawn2', type: 'pawn', color: 'red', row: 6, col: 2 });
  pieces.push({ id: 'r-pawn3', type: 'pawn', color: 'red', row: 6, col: 4 });
  pieces.push({ id: 'r-pawn4', type: 'pawn', color: 'red', row: 6, col: 6 });
  pieces.push({ id: 'r-pawn5', type: 'pawn', color: 'red', row: 6, col: 8 });

  return pieces;
}

// 獲取棋子名稱
export function getPieceName(type: PieceType, color: PieceColor): string {
  const names: Record<PieceColor, Record<PieceType, string>> = {
    red: {
      king: '帥',
      advisor: '仕',
      elephant: '相',
      horse: '馬',
      rook: '車',
      cannon: '炮',
      pawn: '兵',
    },
    black: {
      king: '將',
      advisor: '士',
      elephant: '象',
      horse: '馬',
      rook: '車',
      cannon: '砲',
      pawn: '卒',
    },
  };
  return names[color][type];
}

// 檢查位置是否在棋盤範圍內
function isInBoard(row: number, col: number): boolean {
  return row >= 0 && row <= 9 && col >= 0 && col <= 8;
}

// 檢查位置是否在九宮格內
function isInPalace(row: number, col: number, color: PieceColor): boolean {
  if (col < 3 || col > 5) return false;
  if (color === 'red') {
    return row >= 7 && row <= 9;
  }
  return row >= 0 && row <= 2;
}

// 檢查位置是否在自己的河界內
function isOwnSide(row: number, color: PieceColor): boolean {
  if (color === 'red') {
    return row >= 5 && row <= 9;
  }
  return row >= 0 && row <= 4;
}

// 計算兩個位置之間有多少棋子
function countPiecesBetween(pieces: Piece[], from: Position, to: Position): number {
  let count = 0;
  if (from.row === to.row) {
    const minCol = Math.min(from.col, to.col);
    const maxCol = Math.max(from.col, to.col);
    for (let col = minCol + 1; col < maxCol; col++) {
      if (pieces.some(p => p.row === from.row && p.col === col)) {
        count++;
      }
    }
  } else if (from.col === to.col) {
    const minRow = Math.min(from.row, to.row);
    const maxRow = Math.max(from.row, to.row);
    for (let row = minRow + 1; row < maxRow; row++) {
      if (pieces.some(p => p.row === row && p.col === from.col)) {
        count++;
      }
    }
  }
  return count;
}

// 獲取帥/將的可移動位置
function getKingMoves(piece: Piece, pieces: Piece[]): Position[] {
  const moves: Position[] = [];
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const [dr, dc] of directions) {
    const newRow = piece.row + dr;
    const newCol = piece.col + dc;
    if (isInPalace(newRow, newCol, piece.color)) {
      const targetPiece = pieces.find(p => p.row === newRow && p.col === newCol);
      if (!targetPiece || targetPiece.color !== piece.color) {
        moves.push({ row: newRow, col: newCol });
      }
    }
  }

  // 將帥對面（飛將）
  const otherKing = pieces.find(p => p.type === 'king' && p.color !== piece.color);
  if (otherKing && otherKing.col === piece.col) {
    const between = countPiecesBetween(pieces, { row: piece.row, col: piece.col }, { row: otherKing.row, col: otherKing.col });
    if (between === 0) {
      moves.push({ row: otherKing.row, col: otherKing.col });
    }
  }

  return moves;
}

// 獲取仕/士的可移動位置
function getAdvisorMoves(piece: Piece, pieces: Piece[]): Position[] {
  const moves: Position[] = [];
  const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  for (const [dr, dc] of directions) {
    const newRow = piece.row + dr;
    const newCol = piece.col + dc;
    if (isInPalace(newRow, newCol, piece.color)) {
      const targetPiece = pieces.find(p => p.row === newRow && p.col === newCol);
      if (!targetPiece || targetPiece.color !== piece.color) {
        moves.push({ row: newRow, col: newCol });
      }
    }
  }

  return moves;
}

// 獲取相/象的可移動位置
function getElephantMoves(piece: Piece, pieces: Piece[]): Position[] {
  const moves: Position[] = [];
  const directions = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
  const blocks = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  for (let i = 0; i < directions.length; i++) {
    const [dr, dc] = directions[i];
    const [br, bc] = blocks[i];
    const newRow = piece.row + dr;
    const newCol = piece.col + dc;
    const blockRow = piece.row + br;
    const blockCol = piece.col + bc;

    if (isInBoard(newRow, newCol) && isOwnSide(newRow, piece.color)) {
      // 檢查象眼是否被堵
      const blockingPiece = pieces.find(p => p.row === blockRow && p.col === blockCol);
      if (!blockingPiece) {
        const targetPiece = pieces.find(p => p.row === newRow && p.col === newCol);
        if (!targetPiece || targetPiece.color !== piece.color) {
          moves.push({ row: newRow, col: newCol });
        }
      }
    }
  }

  return moves;
}

// 獲取馬的可移動位置
function getHorseMoves(piece: Piece, pieces: Piece[]): Position[] {
  const moves: Position[] = [];
  const jumps = [
    { dr: -2, dc: -1, br: -1, bc: 0 },
    { dr: -2, dc: 1, br: -1, bc: 0 },
    { dr: 2, dc: -1, br: 1, bc: 0 },
    { dr: 2, dc: 1, br: 1, bc: 0 },
    { dr: -1, dc: -2, br: 0, bc: -1 },
    { dr: -1, dc: 2, br: 0, bc: 1 },
    { dr: 1, dc: -2, br: 0, bc: -1 },
    { dr: 1, dc: 2, br: 0, bc: 1 },
  ];

  for (const { dr, dc, br, bc } of jumps) {
    const newRow = piece.row + dr;
    const newCol = piece.col + dc;
    const blockRow = piece.row + br;
    const blockCol = piece.col + bc;

    if (isInBoard(newRow, newCol)) {
      const blockingPiece = pieces.find(p => p.row === blockRow && p.col === blockCol);
      if (!blockingPiece) {
        const targetPiece = pieces.find(p => p.row === newRow && p.col === newCol);
        if (!targetPiece || targetPiece.color !== piece.color) {
          moves.push({ row: newRow, col: newCol });
        }
      }
    }
  }

  return moves;
}

// 獲取車的可移動位置
function getRookMoves(piece: Piece, pieces: Piece[]): Position[] {
  const moves: Position[] = [];
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const [dr, dc] of directions) {
    let newRow = piece.row + dr;
    let newCol = piece.col + dc;
    while (isInBoard(newRow, newCol)) {
      const targetPiece = pieces.find(p => p.row === newRow && p.col === newCol);
      if (targetPiece) {
        if (targetPiece.color !== piece.color) {
          moves.push({ row: newRow, col: newCol });
        }
        break;
      }
      moves.push({ row: newRow, col: newCol });
      newRow += dr;
      newCol += dc;
    }
  }

  return moves;
}

// 獲取炮的可移動位置
function getCannonMoves(piece: Piece, pieces: Piece[]): Position[] {
  const moves: Position[] = [];
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const [dr, dc] of directions) {
    let newRow = piece.row + dr;
    let newCol = piece.col + dc;
    let jumped = false;

    while (isInBoard(newRow, newCol)) {
      const targetPiece = pieces.find(p => p.row === newRow && p.col === newCol);
      if (!jumped) {
        if (targetPiece) {
          jumped = true;
        } else {
          moves.push({ row: newRow, col: newCol });
        }
      } else {
        if (targetPiece) {
          if (targetPiece.color !== piece.color) {
            moves.push({ row: newRow, col: newCol });
          }
          break;
        }
      }
      newRow += dr;
      newCol += dc;
    }
  }

  return moves;
}

// 獲取兵/卒的可移動位置
function getPawnMoves(piece: Piece, pieces: Piece[]): Position[] {
  const moves: Position[] = [];
  const forward = piece.color === 'red' ? -1 : 1;
  const crossedRiver = !isOwnSide(piece.row, piece.color);

  // 前進
  const forwardRow = piece.row + forward;
  if (isInBoard(forwardRow, piece.col)) {
    const targetPiece = pieces.find(p => p.row === forwardRow && p.col === piece.col);
    if (!targetPiece || targetPiece.color !== piece.color) {
      moves.push({ row: forwardRow, col: piece.col });
    }
  }

  // 過河後可以左右移動
  if (crossedRiver) {
    for (const dc of [-1, 1]) {
      const newCol = piece.col + dc;
      if (isInBoard(piece.row, newCol)) {
        const targetPiece = pieces.find(p => p.row === piece.row && p.col === newCol);
        if (!targetPiece || targetPiece.color !== piece.color) {
          moves.push({ row: piece.row, col: newCol });
        }
      }
    }
  }

  return moves;
}

// 獲取棋子的所有合法移動位置
export function getValidMoves(piece: Piece, pieces: Piece[]): Position[] {
  let moves: Position[] = [];

  switch (piece.type) {
    case 'king':
      moves = getKingMoves(piece, pieces);
      break;
    case 'advisor':
      moves = getAdvisorMoves(piece, pieces);
      break;
    case 'elephant':
      moves = getElephantMoves(piece, pieces);
      break;
    case 'horse':
      moves = getHorseMoves(piece, pieces);
      break;
    case 'rook':
      moves = getRookMoves(piece, pieces);
      break;
    case 'cannon':
      moves = getCannonMoves(piece, pieces);
      break;
    case 'pawn':
      moves = getPawnMoves(piece, pieces);
      break;
  }

  // 過濾掉會導致自己被將軍的移動
  return moves.filter(move => {
    const newPieces = simulateMove(pieces, piece, move);
    return !isKingInCheck(newPieces, piece.color);
  });
}

// 模擬移動
function simulateMove(pieces: Piece[], piece: Piece, to: Position): Piece[] {
  return pieces
    .filter(p => !(p.row === to.row && p.col === to.col))
    .map(p => {
      if (p.id === piece.id) {
        return { ...p, row: to.row, col: to.col };
      }
      return p;
    });
}

// 檢查國王是否被將軍
export function isKingInCheck(pieces: Piece[], color: PieceColor): boolean {
  const king = pieces.find(p => p.type === 'king' && p.color === color);
  if (!king) return true;

  const opponentPieces = pieces.filter(p => p.color !== color);
  for (const opponent of opponentPieces) {
    const rawMoves = getRawMoves(opponent, pieces);
    if (rawMoves.some(m => m.row === king.row && m.col === king.col)) {
      return true;
    }
  }

  // 檢查將帥對面
  const otherKing = pieces.find(p => p.type === 'king' && p.color !== color);
  if (otherKing && otherKing.col === king.col) {
    const between = countPiecesBetween(pieces, { row: king.row, col: king.col }, { row: otherKing.row, col: otherKing.col });
    if (between === 0) {
      return true;
    }
  }

  return false;
}

// 獲取原始移動位置（不過濾自殺走法）
function getRawMoves(piece: Piece, pieces: Piece[]): Position[] {
  switch (piece.type) {
    case 'king': return getKingMoves(piece, pieces);
    case 'advisor': return getAdvisorMoves(piece, pieces);
    case 'elephant': return getElephantMoves(piece, pieces);
    case 'horse': return getHorseMoves(piece, pieces);
    case 'rook': return getRookMoves(piece, pieces);
    case 'cannon': return getCannonMoves(piece, pieces);
    case 'pawn': return getPawnMoves(piece, pieces);
    default: return [];
  }
}

// 檢查是否將死
export function isCheckmate(pieces: Piece[], color: PieceColor): boolean {
  const myPieces = pieces.filter(p => p.color === color);
  for (const piece of myPieces) {
    const moves = getValidMoves(piece, pieces);
    if (moves.length > 0) return false;
  }
  return true;
}
