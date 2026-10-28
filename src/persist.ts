// 브라우저 안 저장소(IndexedDB): 자동 저장과 버전 스냅샷
import type { Project } from './types';
import { uid } from './util';

let dbp: Promise<IDBDatabase> | null = null;

function db() {
  return (dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open('renpy-flow-editor', 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('kv');
      r.result.createObjectStore('snapshots', { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  return db().then(
    (d) =>
      new Promise<T>((res, rej) => {
        const req = fn(d.transaction(store, mode).objectStore(store));
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      }),
  );
}

export const kvGet = (k: string) => run<any>('kv', 'readonly', (s) => s.get(k));
export const kvSet = (k: string, v: unknown) => run('kv', 'readwrite', (s) => s.put(v, k));

export interface Snapshot { id: string; time: number; memo: string; project: Project }

export const snapAdd = (memo: string, project: Project) =>
  run('snapshots', 'readwrite', (s) => s.put({ id: uid('s'), time: Date.now(), memo, project: structuredClone(project) }));

export const snapList = async () =>
  ((await run<Snapshot[]>('snapshots', 'readonly', (s) => s.getAll())) ?? []).sort((a, b) => b.time - a.time);

export const snapDelete = (id: string) => run('snapshots', 'readwrite', (s) => s.delete(id));
