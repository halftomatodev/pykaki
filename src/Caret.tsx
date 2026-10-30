// 상자 안에서 글을 쓰는 동안 보이는 밑줄 커서.
// 브라우저 커서는 숨기고, 입력칸과 똑같이 글자를 늘어놓은 보이지 않는 복사본으로 커서 자리를 잰다.
import { useEffect, useState } from 'react';

const COPY = [
  'boxSizing', 'width', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch',
  'fontSize', 'fontFamily', 'lineHeight', 'letterSpacing', 'wordSpacing', 'textTransform', 'textIndent', 'tabSize',
] as const;

type Field = HTMLInputElement | HTMLTextAreaElement;
interface Spot { x: number; y: number; w: number; h: number } // 입력칸 왼쪽 위 기준, 확대/축소 전 크기

function measure(el: Field, pos: number): Spot {
  const cs = getComputedStyle(el);
  const m = document.createElement('div');
  for (const k of COPY) m.style[k] = cs[k];
  const area = el.tagName === 'TEXTAREA';
  Object.assign(m.style, { position: 'absolute', visibility: 'hidden', top: '0', left: '-9999px', overflow: 'hidden', whiteSpace: area ? 'pre-wrap' : 'pre', overflowWrap: area ? 'break-word' : 'normal' });
  m.textContent = el.value.slice(0, pos);
  const next = el.value[pos];
  const s = document.createElement('span');
  s.textContent = next && next !== '\n' ? next : '.';
  m.appendChild(s);
  document.body.appendChild(m);
  const fs = parseFloat(cs.fontSize);
  const pt = parseFloat(cs.paddingTop);
  // 밑줄은 글자 칸(span)의 아래쪽에 긋는다. 한 줄 입력칸은 글자가 세로 가운데에 놓인다
  const bottom = area
    ? s.offsetTop + s.offsetHeight - el.scrollTop
    : pt + (el.clientHeight - pt - parseFloat(cs.paddingBottom) + s.offsetHeight) / 2;
  const spot = {
    x: s.offsetLeft + el.clientLeft - el.scrollLeft,
    y: bottom + el.clientTop,
    w: next && next !== '\n' ? s.offsetWidth : fs * 0.6,
    h: Math.max(2, fs * 0.14),
  };
  m.remove();
  return spot;
}

const editable = (el: Element | null): el is Field =>
  !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'text' && !(el as HTMLInputElement).readOnly)) && !!el.closest('.box.editing');

export function EditCaret() {
  const [at, setAt] = useState<{ left: number; top: number; width: number; height: number; k: string } | null>(null);

  useEffect(() => {
    let composing = false;
    let last = '';
    let spot: Spot | null = null;
    let raf = 0;

    // 화면이 움직여도(이동, 확대) 따라가도록 매 프레임 자리를 다시 계산한다. 잴 것은 글이나 커서가 바뀔 때만 잰다
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = document.activeElement;
      if (!editable(el) || (el.selectionStart !== el.selectionEnd && !composing)) {
        if (last) (setAt(null), (last = ''));
        return;
      }
      const pos = el.selectionEnd ?? 0;
      const sig = `${el.id}|${pos}|${el.value.length}|${el.offsetWidth}|${el.scrollTop}|${el.scrollLeft}`;
      if (sig !== last.split('#')[0] || !spot) spot = measure(el, pos);
      const r = el.getBoundingClientRect();
      const z = r.width / (el.offsetWidth || 1);
      const left = r.left + spot.x * z;
      const top = r.top + spot.y * z - spot.h * z;
      // 스크롤로 입력칸 밖에 있으면 그리지 않는다
      if (left < r.left - 1 || left > r.right || top < r.top || top > r.bottom + 2) {
        if (last) (setAt(null), (last = ''));
        return;
      }
      const key = `${sig}#${Math.round(left)},${Math.round(top)},${z.toFixed(3)}`;
      if (key === last) return;
      last = key;
      // 커서가 움직이면 깜박임을 처음부터(켜진 상태로) 다시 시작한다
      setAt({ left, top, width: Math.max(spot.w * z, 4), height: Math.max(spot.h * z, 2), k: sig });
    };
    const onStart = () => (composing = true);
    const onEnd = () => (composing = false);
    document.addEventListener('compositionstart', onStart);
    document.addEventListener('compositionend', onEnd);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('compositionstart', onStart);
      document.removeEventListener('compositionend', onEnd);
    };
  }, []);

  if (!at) return null;
  return <div key={at.k} className="ucaret" style={{ left: at.left, top: at.top, width: at.width, height: at.height }} />;
}
