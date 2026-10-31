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

// box·label은 그라데이션 테마와 직접 고르기에서만: 상자와 label 배경을 이 색으로 칠한다
export interface Colors { bg: string; panel: string; text: string; accent: string; box?: string; label?: string }
export type ThemeId = 'apple' | 'apple-color' | 'light' | 'dark' | 'onebit' | 'onebit-light' | 'custom';
export interface Grad { a: string; b: string } // a: 바탕 쪽 색, b: 끝 색
export type GradId = 'light' | 'dark';

// look: 사과 스타일(Apple 디자인 참고, 처음 값). 경계선 없이 둥근 카드와 바탕색 차이로만 구분한다 (apple-color는 label 색을 진하게)
// grad: 그라데이션 테마. 두 색 사이에서 바탕 → label 배경 → 상자 순서로 색을 정한다
// mono: 1비트 테마. 칠하지 않고 모두 같은 바탕에 글자색 선만 긋는다
export type Look = 'apple' | 'apple-color';
export const THEMES: { id: Exclude<ThemeId, 'custom'>; label: string; colors: Colors; mono?: boolean; look?: Look; grad?: GradId }[] = [
  { id: 'apple', label: '사과 스타일', colors: { bg: '#f2f2f7', panel: '#ffffff', text: '#1c1c1e', accent: '#007aff' }, look: 'apple' },
  { id: 'apple-color', label: '사과 컬러풀', colors: { bg: '#f2f2f7', panel: '#ffffff', text: '#1c1c1e', accent: '#007aff' }, look: 'apple-color' },
  { id: 'light', label: '밝게', colors: { bg: '#ffffff', panel: '#f8f8f8', text: '#1c1c1e', accent: '#58585d' }, grad: 'light' },
  { id: 'dark', label: '어둡게', colors: { bg: '#000000', panel: '#0b0714', text: '#ececf1', accent: '#a684f8' }, grad: 'dark' },
  { id: 'onebit', label: '1비트', colors: { bg: '#000000', panel: '#000000', text: '#ffffff', accent: '#ffffff' }, mono: true },
  { id: 'onebit-light', label: '1비트 흰 바탕', colors: { bg: '#ffffff', panel: '#ffffff', text: '#000000', accent: '#000000' }, mono: true },
];
export const GRAD_DEFAULTS: Record<GradId, Grad> = { light: { a: '#ffffff', b: '#8e8e93' }, dark: { a: '#000000', b: '#8b5cf6' } };

// 두 색 섞기 (t=0이면 a, 1이면 b)
export function mixHex(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const lum = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
};
// 그 색 위에 쓸 글자색
export const textOn = (h: string) => (lum(h) < 140 ? '#ececf1' : '#1c1c1e');

// 그라데이션: 바탕 0%, 옆 패널 8%, label 배경 30%, 상자 55%
export function gradColors(g: Grad): Colors {
  const dark = lum(g.a) < 128;
  return {
    bg: g.a,
    panel: mixHex(g.a, g.b, 0.08),
    text: textOn(g.a),
    accent: dark ? mixHex(g.b, '#ffffff', 0.3) : mixHex(g.b, '#000000', 0.4),
    label: mixHex(g.a, g.b, 0.3),
    box: mixHex(g.a, g.b, 0.55),
  };
}


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
  frameWidth: number; // label 경계선 굵기 (px, 0이면 안 보임)
  grads: Record<GradId, Grad>; // 밝게/어둡게 테마의 두 색
  textColor: string | null; // 텍스트 색. null이면 테마가 정한 색
}

const KEY = 'pykaki-prefs';
const defKeys = () => Object.fromEntries(ACTIONS.map((a) => [a.id, a.def])) as Record<ActionId, string>;

// 처음 값
const defaults = (): Prefs => ({
  theme: 'apple', custom: { ...THEMES.find((t) => t.id === 'apple')!.colors, box: '#ffffff' }, keys: defKeys(),
  font: 'default', dim: 'mid', frameWidth: 3, grads: structuredClone(GRAD_DEFAULTS), textColor: null,
});

function loadPrefs(): Prefs {
  const d = defaults();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw) return { ...d, ...raw, custom: { ...d.custom, ...raw.custom }, keys: { ...d.keys, ...raw.keys }, grads: { light: { ...d.grads.light, ...raw.grads?.light }, dark: { ...d.grads.dark, ...raw.grads?.dark } } };
  } catch {
    // 저장소를 못 쓰는 브라우저면 기본값으로
  }
  return d;
}

export const usePrefs = create<Prefs>(loadPrefs);
export const resetKeys = () => usePrefs.setState({ keys: defKeys() });
export const resetPrefs = () => usePrefs.setState(defaults());

const themeOf = (p: Prefs) => THEMES.find((t) => t.id === p.theme) ?? THEMES[0];
export const colorsOf = (p: Prefs): Colors => {
  if (p.theme === 'custom') return p.custom;
  const t = themeOf(p);
  return t.grad ? gradColors(p.grads[t.grad]) : t.colors;
};
export const gradOf = (p: Prefs) => (p.theme === 'custom' ? undefined : themeOf(p).grad);
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
  r.style.setProperty('--text', p.textColor ?? c.text);
  r.dataset.textfix = p.textColor ? '1' : '';
  if (p.textColor) r.style.setProperty('--text-fix', p.textColor);
  r.dataset.grad = gradOf(p) ? '1' : '';
  r.style.setProperty('--accent', c.accent);
  r.dataset.dark = isDark(c) ? '1' : '';
  r.dataset.mono = isMono(p) ? '1' : '';
  r.style.setProperty('--frame-w', Math.min(6, Math.max(0, p.frameWidth)) + 'px');
  r.dataset.look = lookOf(p) ?? '';
  // 그라데이션·직접 고르기 테마: 상자와 label 배경을 테마 색으로 칠한다
  const fill = (name: string, v?: string) => {
    r.dataset[name + 'fill'] = v ? '1' : '';
    if (v) (r.style.setProperty(`--theme-${name}`, v), r.style.setProperty(`--theme-${name}-text`, textOn(v)));
  };
  fill('box', isMono(p) ? undefined : c.box);
  fill('label', isMono(p) ? undefined : c.label);
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
