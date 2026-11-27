import type { Piece } from './types';
import { MateSearch, applyMove, legalMoves, sameMove, type Move } from './puzzleEngine';
import { generatePuzzle } from './generator';

// Web Worker 與主執行緒（後備）共用的運算請求。
export type EngineRequest =
  | { type: 'solutions'; pieces: Piece[]; remaining: number }
  | { type: 'reply'; pieces: Piece[]; remaining: number; mode: ReplyMode; preferred: Move | null; random: number }
  | { type: 'generate'; seed: number; mateIn: 1 | 2 | 3 };

export type ReplyMode = 'random' | 'toughest';

let search = new MateSearch('red');

export function runEngine(request: EngineRequest): unknown {
  if (request.type === 'generate') return generatePuzzle(request.seed, request.mateIn);
  // 快取過大時重建，避免記憶體持續增長
  if (search.cacheSize > 200000) search = new MateSearch('red');
  if (request.type === 'solutions') return search.solutions(request.pieces, request.remaining);
  // 黑方應手：只從「紅方仍保證在剩餘步數內將死」的合法應手中挑選（題目已驗證全部應手都符合）
  const replies = legalMoves(request.pieces, 'black')
    .filter(reply => search.within(applyMove(request.pieces, reply), request.remaining));
  if (replies.length === 0) return null;
  if (request.mode === 'random') return replies[Math.floor(request.random * replies.length) % replies.length];
  if (request.preferred && replies.some(reply => sameMove(reply, request.preferred!))) return request.preferred;
  return search.toughest(request.pieces, request.remaining);
}
