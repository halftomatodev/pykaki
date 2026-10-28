// 렌파이 텍스트 태그 일부를 흉내 내서 보여 준다: {b} {i} {u} {s} {color=} {size=} {p} {w} {nw} {fast} {a=}
import type { CSSProperties, ReactNode } from 'react';

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
