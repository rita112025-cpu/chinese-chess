import { runEngine, type EngineRequest } from './engineCore';

self.onmessage = (event: MessageEvent<{ id: number; request: EngineRequest }>) => {
  const { id, request } = event.data;
  try {
    self.postMessage({ id, result: runEngine(request) });
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};
