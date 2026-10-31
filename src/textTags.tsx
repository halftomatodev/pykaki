// 렌파이 텍스트 태그 일부를 흉내 내서 보여 준다: {b} {i} {u} {s} {color=} {size=} {p} {w} {nw} {fast} {a=}
import type { CSSProperties, ReactNode } from 'react';

// 플레이 화면용: 글자 하나씩으로 나눈다. 언제 멈출지(stops)와 글자별 속도도 함께
export interface Glyph { ch: string; style: CSSProperties; rate: number } // rate: 글자 속도 배율, 또는 fixed면 글자/초
export interface Stop { at: number; sec: number | null } // at번째 글자 앞에서 멈춤. sec가 null이면 클릭할 때까지
export interface Tagged { glyphs: (Glyph & { fixed: boolean })[]; stops: Stop[]; noWait: boolean; fastTo: number }

export function parseTagged(text: string, tagsOn: boolean, fontOf: (path: string) => string | undefined): Tagged {
  const out: Tagged = { glyphs: [], stops: [], noWait: false, fastTo: 0 };
  const stack: { name: string; style: CSSProperties; rate?: number; fixed?: boolean }[] = [];
  const add = (s: string) => {
    let rate = 1;
    let fixed = false;
    const style: CSSProperties = {};
    for (const e of stack) {
      Object.assign(style, e.style);
      if (e.rate !== undefined) (rate = e.rate, (fixed = !!e.fixed));
    }
    for (const ch of Array.from(s)) out.glyphs.push({ ch, style, rate, fixed });
  };
  if (!tagsOn) return add(text), out;

  for (let i = 0; i < text.length; ) {
    if (text.startsWith('{{', i)) {
      add('{');
      i += 2;
      continue;
    }
    if (text[i] !== '{') {
      const j = text.indexOf('{', i);
      const end = j < 0 ? text.length : j;
      add(text.slice(i, end));
      i = end;
      continue;
    }
    const j = text.indexOf('}', i);
    if (j < 0) {
      add(text.slice(i));
      break;
    }
    const tag = text.slice(i + 1, j);
    i = j + 1;
    if (tag.startsWith('/')) {
      const name = tag.slice(1);
      for (let k = stack.length - 1; k >= 0; k--) if (stack[k].name === name || !name) {
        stack.splice(k, 1);
        break;
      }
      continue;
    }
    const eq = tag.indexOf('=');
    const name = eq < 0 ? tag : tag.slice(0, eq);
    const val = eq < 0 ? '' : tag.slice(eq + 1);
    const push = (style: CSSProperties, rate?: number, fixed?: boolean) => stack.push({ name, style, rate, fixed });
    if (name === 'b') push({ fontWeight: 'bold' });
    else if (name === 'i') push({ fontStyle: 'italic' });
    else if (name === 'u' || name === 'a') push({ textDecoration: 'underline' });
    else if (name === 's') push({ textDecoration: 'line-through' });
    else if (name === 'color') push({ color: val });
    else if (name === 'alpha') push({ opacity: Number(val.replace(/^[*+-]/, '')) || undefined });
    else if (name === 'font') push({ fontFamily: fontOf(val) });
    else if (name === 'k') push({ letterSpacing: Number(val) || undefined });
    else if (name === 'size') {
      const m = /^([*+-]?)([\d.]+)$/.exec(val);
      const n = m ? Number(m[2]) : 0;
      push(!m ? {} : m[1] === '*' ? { fontSize: n + 'em' } : m[1] === '+' ? { fontSize: `calc(1em + ${n}px)` } : m[1] === '-' ? { fontSize: `calc(1em - ${n}px)` } : { fontSize: n });
    } else if (name === 'cps') {
      if (val.startsWith('*')) push({}, Number(val.slice(1)) || 1);
      else push({}, Number(val) || 0, true);
    } else if (name === 'w' || name === 'p') {
      out.stops.push({ at: out.glyphs.length, sec: val ? Number(val) : null });
      if (name === 'p') add('\n');
    } else if (name === 'nw') out.noWait = true;
    else if (name === 'fast') out.fastTo = out.glyphs.length;
    else if (!['image', 'space', 'vspace', 'rt', 'rb', 'art', 'done'].includes(name)) add('{' + tag + '}');
  }
  return out;
}

export function renderTagged(text: string, tagsOn: boolean): ReactNode[] {
  if (!tagsOn) return [text];
  const out: ReactNode[] = [];
  const stack: CSSProperties[] = [];
  let buf = '';
  let k = 0;
  const flush = () => {
    if (!buf) return;
    out.push(<span key={k++} style={Object.assign({}, ...stack)}>{buf}</span>);
    buf = '';
  };
  for (let i = 0; i < text.length; ) {
    if (text.startsWith('{{', i)) {
      buf += '{';
      i += 2;
      continue;
    }
    if (text[i] !== '{') {
      buf += text[i++];
      continue;
    }
    const j = text.indexOf('}', i);
    if (j < 0) {
      buf += text.slice(i);
      break;
    }
    const tag = text.slice(i + 1, j);
    i = j + 1;
    const [name, val] = [tag.split('=')[0], tag.slice(tag.indexOf('=') + 1)];
    const style: CSSProperties | null =
      name === 'b' ? { fontWeight: 'bold' }
      : name === 'i' ? { fontStyle: 'italic' }
      : name === 'u' || name === 'a' ? { textDecoration: 'underline' }
      : name === 's' ? { textDecoration: 'line-through' }
      : name === 'color' ? { color: val }
      : name === 'size' && /^\d+$/.test(val) ? { fontSize: Number(val) * 0.6 }
      : name === 'size' ? {}
      : null;
    flush();
    if (style) stack.push(style);
    else if (tag.startsWith('/')) stack.pop();
    else if (name === 'p') out.push(<br key={k++} />);
    else if (!['w', 'nw', 'fast'].includes(name)) buf += '{' + tag + '}';
  }
  flush();
  return out;
}
