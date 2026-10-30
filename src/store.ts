import { create } from 'zustand';
import type { Project } from './types';

export type Tab = 'edit' | 'play' | 'warn' | 'rpy';
export interface PlayView { current: string | null; visitedNodes: string[]; visitedEdges: string[] }

interface S {
  project: Project;
  past: Project[];
  future: Project[];
  lastKey: string | null;
  lastTime: number;
  dirty: boolean; // 파일로 저장한 뒤 바뀐 것이 있는지
  fileName: string | null;
  localSavedAt: number | null;
  flash: string | null;
  selectedIds: string[];
  focusLineId: string | null;
  inlineEdit: string | null; // 상자 안에서 바로 편집 중인 상자 id
  tab: Tab;
  playing: boolean;
  playStart: string | null;
  playSession: number;
  play: PlayView | null;
  focusReq: { ids: string[]; t: number } | null;
  animating: boolean;
  focusMode: boolean; // 집중 모드: 캔버스만 남기고 나머지 화면을 숨긴다
  showPrefs: boolean; // 환경 설정 창
  flowMenu: boolean; // 다음 흐름 창을 키보드로 고르는 중
  update(fn: (p: Project) => void, key?: string): void;
  load(p: Project, o?: { fileName?: string | null; dirty?: boolean }): void;
  undo(): void;
  redo(): void;
  select(ids: string[]): void;
  focusNodes(ids: string[]): void;
  startPlay(from?: string | null): void;
  stopPlay(): void;
  say(msg: string): void;
}

let flashTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<S>((set, get) => ({
  project: null as unknown as Project,
  past: [],
  future: [],
  lastKey: null,
  lastTime: 0,
  dirty: false,
  fileName: null,
  localSavedAt: null,
  flash: null,
  selectedIds: [],
  focusLineId: null,
  inlineEdit: null,
  tab: 'edit',
  playing: false,
  playStart: null,
  playSession: 0,
  play: null,
  focusReq: null,
  animating: false,
  focusMode: false,
  showPrefs: false,
  flowMenu: false,

  // 같은 key로 빠르게 이어지는 변경(타이핑)은 실행 취소 한 번으로 묶는다
  update: (fn, key) =>
    set((s) => {
      const next = structuredClone(s.project);
      fn(next);
      const now = Date.now();
      const merge = !!key && key === s.lastKey && now - s.lastTime < 1200;
      return {
        project: next,
        past: merge ? s.past : [...s.past.slice(-99), s.project],
        future: [],
        lastKey: key ?? null,
        lastTime: now,
        dirty: true,
      };
    }),

  load: (p, o = {}) =>
    set({
      project: p,
      past: [],
      future: [],
      lastKey: null,
      dirty: o.dirty ?? false,
      fileName: o.fileName === undefined ? get().fileName : o.fileName,
      selectedIds: [],
      inlineEdit: null,
      playing: false,
      play: null,
      focusReq: { ids: p.nodes.map((n) => n.id), t: Date.now() },
    }),

  undo: () =>
    set((s) => {
      if (!s.past.length) return {};
      return { project: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.project, ...s.future], lastKey: null, dirty: true };
    }),

  redo: () =>
    set((s) => {
      if (!s.future.length) return {};
      return { project: s.future[0], future: s.future.slice(1), past: [...s.past, s.project], lastKey: null, dirty: true };
    }),

  select: (ids) => {
    const cur = get().selectedIds;
    if (cur.length === ids.length && ids.every((x) => cur.includes(x))) return;
    const ie = get().inlineEdit;
    set({ selectedIds: ids, inlineEdit: ie && ids.includes(ie) ? ie : null });
  },

  focusNodes: (ids) => set({ focusReq: { ids, t: Date.now() } }),

  startPlay: (from = null) => set((s) => ({ tab: 'play', playing: true, playStart: from, playSession: s.playSession + 1 })),

  stopPlay: () => set({ playing: false, play: null }),

  say: (msg) => {
    clearTimeout(flashTimer);
    set({ flash: msg });
    flashTimer = setTimeout(() => set({ flash: null }), 2500);
  },
}));
