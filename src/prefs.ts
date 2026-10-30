// 환경 설정(화면 색, 단축키). 대본이 아니라 이 브라우저에 붙는 설정이라 localStorage에 둔다.
import { create } from 'zustand';
// Neo둥근모 (SIL OFL 1.1, licenses/OFL-NeoDunggeunmo.txt). 빌드할 때 파일 안에 들어간다
import neodgmUrl from '@kfonts/neodgm/neodgm.woff2?url';
// Pretendard (SIL OFL 1.1, licenses/OFL-Pretendard.txt). 굵기를 고를 수 있는 가변 글꼴 하나를 파일 안에 넣는다
import pretendardUrl from 'pretendard/dist/web/variable/woff2/PretendardVariable.woff2?url';

export type ActionId = 'focus' | 'nextBox' | 'flowMenu' | 'save' | 'saveAs' | 'export' | 'undo' | 'redo' | 'newBox' | 'play' | 'newLine';

// 키는 e.code(자판 위치)로 적는다. 한글 입력 상태에서도 같은 키로 동작한다
export const ACTIONS: { id: ActionId; label: string; def: string }[] = [
  { id: 'focus', label: '집중 모드 (화면 정리)', def: 'Ctrl+Backslash' },
  { id: 'newLine', label: '같은 화자로 새 줄', def: 'Ctrl+Enter' },
  { id: 'nextBox', label: '다음 상자로 이어 쓰기', def: 'Ctrl+Shift+Enter' },
  { id: 'flowMenu', label: '다음 흐름 창 열기/닫기 (키보드로 고르기)', def: 'Alt+Enter' },
  { id: 'save', label: '파일 저장', def: 'Ctrl+KeyS' },
  { id: 'saveAs', label: '다른 이름으로 저장', def: 'Ctrl+Shift+KeyS' },
  { id: 'export', label: '.rpy 같은 곳에 다시 내보내기', def: 'Ctrl+KeyE' },
  { id: 'undo', label: '실행 취소', def: 'Ctrl+KeyZ' },
  { id: 'redo', label: '다시 실행', def: 'Ctrl+KeyY' },
  { id: 'newBox', label: '새 상자', def: 'Alt+KeyN' },
  { id: 'play', label: '처음부터 플레이', def: 'Alt+KeyP' },
];

export interface Colors { bg: string; panel: string; text: string; accent: string }
export type ThemeId = 'light' | 'paper' | 'dark' | 'onebit' | 'onebit-light' | 'apple' | 'apple-color' | 'custom';

// mono: 1비트 테마. 칠하지 않고 모두 같은 바탕에 글자색 선만 긋는다
// look: 사과 스타일(Apple 디자인 참고, 처음 값). 경계선 없이 둥근 카드와 바탕색 차이로만 구분한다 (apple-color는 label 색을 진하게)
export type Look = 'apple' | 'apple-color';
export const THEMES: { id: Exclude<ThemeId, 'custom'>; label: string; colors: Colors; mono?: boolean; look?: Look }[] = [
  { id: 'light', label: '밝게', colors: { bg: '#f5f5f3', panel: '#fcfcfb', text: '#33343a', accent: '#6b7bd6' } },
  { id: 'paper', label: '종이', colors: { bg: '#efebe2', panel: '#f8f5ee', text: '#3d3832', accent: '#a26b45' } },
  { id: 'dark', label: '어둡게', colors: { bg: '#1d1e22', panel: '#25272c', text: '#cfd0d4', accent: '#8f9cf0' } },
  { id: 'onebit', label: '1비트', colors: { bg: '#000000', panel: '#000000', text: '#ffffff', accent: '#ffffff' }, mono: true },
  { id: 'onebit-light', label: '1비트 흰 바탕', colors: { bg: '#ffffff', panel: '#ffffff', text: '#000000', accent: '#000000' }, mono: true },
  { id: 'apple', label: '사과 스타일', colors: { bg: '#f2f2f7', panel: '#ffffff', text: '#1c1c1e', accent: '#007aff' }, look: 'apple' },
  { id: 'apple-color', label: '사과 컬러풀', colors: { bg: '#f2f2f7', panel: '#ffffff', text: '#1c1c1e', accent: '#007aff' }, look: 'apple-color' },
];


export type FontId = 'default' | 'pretendard-500' | 'pretendard-600' | 'neodgm';
// 'default'는 예전 설정과 맞추려고 Pretendard 400의 id로 남겨 둔다
const PRETENDARD = "'Pretendard Variable', 'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', system-ui, sans-serif";
const MONO = "Consolas, 'D2Coding', monospace";
export const FONTS: { id: FontId; label: string; family: string; mono: string; weight: number }[] = [
  { id: 'default', label: 'Pretendard 400', family: PRETENDARD, mono: MONO, weight: 400 },
  { id: 'pretendard-500', label: 'Pretendard 500', family: PRETENDARD, mono: MONO, weight: 500 },
  { id: 'pretendard-600', label: 'Pretendard 600', family: PRETENDARD, mono: MONO, weight: 600 },
  { id: 'neodgm', label: 'Neo둥근모', family: "'NeoDunggeunmo', 'Malgun Gothic', sans-serif", mono: "'NeoDunggeunmo', Consolas, monospace", weight: 400 },
];

// 집중 모드에서 글을 쓸 때: [같은 상자의 다른 줄, 다른 상자] 불투명도
export type DimId = 'off' | 'weak' | 'mid' | 'strong';
export const DIMS: { id: DimId; label: string; line: number; box: number }[] = [
  { id: 'off', label: '끄기', line: 1, box: 1 },
  { id: 'weak', label: '약하게', line: 0.6, box: 0.4 },
  { id: 'mid', label: '보통', line: 0.4, box: 0.18 },
  { id: 'strong', label: '강하게', line: 0.22, box: 0.07 },
];

interface Prefs {
  theme: ThemeId;
  custom: Colors;
  keys: Record<ActionId, string>;
  font: FontId;
  dim: DimId;
  boxStrength: number; // 상자·label 배경·이름표를 얼마나 진하게 칠할지 (0~100)
  frameWidth: number; // label 경계선 굵기 (px)
  labelTint: number; // 상자와 label 배경에 label 색을 얼마나 입힐지 (0~100)
}

const KEY = 'pykaki-prefs';
const defKeys = () => Object.fromEntries(ACTIONS.map((a) => [a.id, a.def])) as Record<ActionId, string>;

function loadPrefs(): Prefs {
  const d: Prefs = { theme: 'apple', custom: { ...THEMES.find((t) => t.id === 'apple')!.colors }, keys: defKeys(), font: 'default', dim: 'mid', boxStrength: 30, frameWidth: 3, labelTint: 50 };
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

const themeOf = (p: Prefs) => THEMES.find((t) => t.id === p.theme) ?? THEMES[0];
export const colorsOf = (p: Prefs) => (p.theme === 'custom' ? p.custom : themeOf(p).colors);
export const isMono = (p: Prefs) => p.theme !== 'custom' && !!themeOf(p).mono;
export const lookOf = (p: Prefs) => (p.theme === 'custom' ? undefined : themeOf(p).look);

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
  r.dataset.mono = isMono(p) ? '1' : '';
  r.style.setProperty('--frame-w', Math.min(6, Math.max(1, p.frameWidth)) + 'px');
  r.dataset.look = lookOf(p) ?? '';
  r.style.setProperty('--label-tint', String(Math.min(100, Math.max(0, p.labelTint)) / 100));
  r.style.setProperty('--box-strength', String(Math.min(100, Math.max(0, p.boxStrength)) / 100));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.bg);
  const f = FONTS.find((x) => x.id === p.font) ?? FONTS[0];
  r.style.setProperty('--font', f.family);
  r.style.setProperty('--font-weight', String(f.weight));
  r.style.setProperty('--mono', f.mono);
  r.dataset.font = f.id;
  const dm = DIMS.find((x) => x.id === p.dim) ?? DIMS[2];
  r.style.setProperty('--dim-line', String(dm.line));
  r.style.setProperty('--dim-box', String(dm.box));
}

// 글꼴은 고르거나 설정 창에서 미리 볼 때만 읽어 들인다
const added = new Set<string>();
function addFont(family: string, url: string, weight = '400') {
  if (added.has(family) || typeof FontFace === 'undefined') return;
  added.add(family);
  const ff = new FontFace(family, `url(${url}) format('woff2')`, { weight, display: 'swap' });
  document.fonts.add(ff);
  ff.load().catch((e) => console.warn('글꼴을 못 읽었어요', family, e));
}
export const ensureNeodgm = () => addFont('NeoDunggeunmo', neodgmUrl);
export const ensurePretendard = () => addFont('Pretendard Variable', pretendardUrl, '45 930');
const loadFont = (p: Prefs) => (p.font === 'neodgm' ? ensureNeodgm() : ensurePretendard());

apply(usePrefs.getState());
loadFont(usePrefs.getState());
usePrefs.subscribe((p) => {
  apply(p);
  loadFont(p);
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
