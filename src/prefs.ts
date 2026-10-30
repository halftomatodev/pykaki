// 환경 설정(화면 색, 단축키). 대본이 아니라 이 브라우저에 붙는 설정이라 localStorage에 둔다.
import { create } from 'zustand';

export type ActionId = 'focus' | 'save' | 'saveAs' | 'export' | 'undo' | 'redo' | 'newBox' | 'play' | 'newLine';

// 키는 e.code(자판 위치)로 적는다. 한글 입력 상태에서도 같은 키로 동작한다
export const ACTIONS: { id: ActionId; label: string; def: string }[] = [
  { id: 'focus', label: '집중 모드 (화면 정리)', def: 'Ctrl+Backslash' },
  { id: 'newLine', label: '같은 화자로 새 줄', def: 'Ctrl+Enter' },
  { id: 'save', label: '파일 저장', def: 'Ctrl+KeyS' },
  { id: 'saveAs', label: '다른 이름으로 저장', def: 'Ctrl+Shift+KeyS' },
  { id: 'export', label: '.rpy 같은 곳에 다시 내보내기', def: 'Ctrl+KeyE' },
  { id: 'undo', label: '실행 취소', def: 'Ctrl+KeyZ' },
  { id: 'redo', label: '다시 실행', def: 'Ctrl+KeyY' },
  { id: 'newBox', label: '새 상자', def: 'Alt+KeyN' },
  { id: 'play', label: '처음부터 플레이', def: 'Alt+KeyP' },
];

export interface Colors { bg: string; panel: string; text: string; accent: string }
export type ThemeId = 'light' | 'paper' | 'dark' | 'custom';

export const THEMES: { id: Exclude<ThemeId, 'custom'>; label: string; colors: Colors }[] = [
  { id: 'light', label: '밝게', colors: { bg: '#f5f5f3', panel: '#fcfcfb', text: '#33343a', accent: '#6b7bd6' } },
  { id: 'paper', label: '종이', colors: { bg: '#efebe2', panel: '#f8f5ee', text: '#3d3832', accent: '#a26b45' } },
  { id: 'dark', label: '어둡게', colors: { bg: '#1d1e22', panel: '#25272c', text: '#cfd0d4', accent: '#8f9cf0' } },
];

interface Prefs {
  theme: ThemeId;
  custom: Colors;
  keys: Record<ActionId, string>;
}

const KEY = 'pykaki-prefs';
const defKeys = () => Object.fromEntries(ACTIONS.map((a) => [a.id, a.def])) as Record<ActionId, string>;

function loadPrefs(): Prefs {
  const d: Prefs = { theme: 'light', custom: { ...THEMES[0].colors }, keys: defKeys() };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw) return { ...d, ...raw, custom: { ...d.custom, ...raw.custom }, keys: { ...d.keys, ...raw.keys } };
  } catch {
    // 저장소를 못 쓰는 브라우저면 기본값으로
  }
  return d;
}

export const usePrefs = create<Prefs>(loadPrefs);
export const resetKeys = () => usePrefs.setState({ keys: defKeys() });

export const colorsOf = (p: Prefs) => (p.theme === 'custom' ? p.custom : THEMES.find((t) => t.id === p.theme)!.colors);

// 배경이 어두우면 캔버스(React Flow)도 어두운 모드로
export function isDark(c: Colors) {
  const n = parseInt(c.bg.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 128;
}

function apply(p: Prefs) {
  const c = colorsOf(p);
  const r = document.documentElement;
  r.style.setProperty('--bg', c.bg);
  r.style.setProperty('--panel', c.panel);
  r.style.setProperty('--text', c.text);
  r.style.setProperty('--accent', c.accent);
  r.dataset.dark = isDark(c) ? '1' : '';
}

apply(usePrefs.getState());
usePrefs.subscribe((p) => {
  apply(p);
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // 저장 못 해도 이번 창에서는 적용된다
  }
});

// ── 단축키 ──
const MOD_CODES = new Set(['ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']);

// 눌린 키 조합 → 'Ctrl+Shift+KeyS'. 수식키만 눌렸으면 null. 맥의 Cmd는 Ctrl로 본다
export function comboOf(e: KeyboardEvent | React.KeyboardEvent) {
  if (!e.code || MOD_CODES.has(e.code)) return null;
  return [(e.ctrlKey || e.metaKey) && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.code].filter(Boolean).join('+');
}

export const hit = (e: KeyboardEvent | React.KeyboardEvent, id: ActionId) => {
  const k = usePrefs.getState().keys[id];
  return !!k && comboOf(e) === k;
};

const KEY_NAMES: Record<string, string> = {
  Backslash: '\\(₩)', Slash: '/', Period: '.', Comma: ',', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']',
  Minus: '-', Equal: '=', Backquote: '`', Space: 'Space', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  IntlBackslash: '\\', IntlYen: '₩',
};

export function comboLabel(c: string) {
  if (!c) return '없음';
  return c
    .split('+')
    .map((p) => KEY_NAMES[p] ?? p.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num'))
    .join('+');
}

// 단축키 이름 (툴팁용)
export const keyOf = (id: ActionId) => comboLabel(usePrefs.getState().keys[id]);
