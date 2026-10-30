export const uid = (prefix: string) => prefix + Math.random().toString(36).slice(2, 8);

export const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

// 렌파이/파이썬에서 label 이름이나 캐릭터 변수로 쓰면 안 되는 이름
export const RESERVED = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
  'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import', 'in',
  'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
  'renpy', 'config', 'store', 'style', 'gui', 'persistent', 'narrator', 'extend', 'centered', 'vcentered',
  'menu', 'jump', 'call', 'label', 'scene', 'show', 'hide', 'play', 'stop', 'queue', 'define', 'default',
]);

export const PALETTE = [
  '#dbeafe', '#dcfce7', '#fef3c7', '#fce7f3', '#ede9fe',
  '#ffedd5', '#cffafe', '#e2e8f0', '#fee2e2', '#ecfccb',
];

export function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

export function hexAlpha(hex: string, a: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export const timeStr = (t: number) =>
  new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });


// 색이 밝은지 (그 위에 검은 글자를 쓸지)
export function isLight(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return true;
  const n = parseInt(m[1], 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150;
}
