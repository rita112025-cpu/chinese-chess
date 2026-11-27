import { runEngine, type EngineRequest } from './engineCore';

// 以 Web Worker 執行規則引擎搜尋，避免畫面卡頓；不支援 Worker 時改在主執行緒執行。
export class EngineClient {
  private worker: Worker | null = null;
  private next = 1;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

  private ensure(): Worker | null {
    if (this.worker || typeof Worker === 'undefined') return this.worker;
    try {
      this.worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (event: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
        const job = this.pending.get(event.data.id);
        if (!job) return;
        this.pending.delete(event.data.id);
        if (event.data.error) job.reject(new Error(event.data.error));
        else job.resolve(event.data.result);
      };
      this.worker.onerror = () => this.reset(new Error('引擎執行緒發生錯誤'));
    } catch {
      this.worker = null;
    }
    return this.worker;
  }

  run<T>(request: EngineRequest): Promise<T> {
    const worker = this.ensure();
    if (!worker) {
      return new Promise((resolve, reject) => setTimeout(() => {
        try { resolve(runEngine(request) as T); } catch (error) { reject(error as Error); }
      }, 0));
    }
    const id = this.next++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      worker.postMessage({ id, request });
    });
  }

  // 中止進行中的工作（例如使用者改出另一題），並捨棄尚未完成的結果
  reset(reason = new Error('已取消')) {
    this.worker?.terminate();
    this.worker = null;
    for (const job of this.pending.values()) job.reject(reason);
    this.pending.clear();
  }
}
