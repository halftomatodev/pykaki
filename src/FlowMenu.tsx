// 글을 고치는 동안 상자 오른쪽에 붙는 "다음 흐름" 창.
// 항목이 모두 펼쳐져 있고, 단축키(기본 Alt+Enter)로 들어가 ↑↓·Enter·←·Esc로 키보드만으로 고른다
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from './store';
import * as ops from './ops';
import type { BoxNode, ExitType } from './types';
import { continueInNewBox, focusField, goNextBox } from './actions';
import { hit, keyOf } from './prefs';

interface Item {
  key: string;
  label: string;
  hint?: string;
  on?: boolean; // 지금 고른 것
  section?: string; // 이 항목 위에 붙는 제목
  run: () => void;
}

const TYPES: [ExitType, string][] = [
  ['next', '→ 다음 상자로'],
  ['menu', '◆ 선택지'],
  ['call', '⤷ call 후 계속'],
  ['return', '■ 끝 (return)'],
];

export function FlowMenu({ b }: { b: BoxNode }) {
  const project = useStore((s) => s.project);
  const update = useStore((s) => s.update);
  const active = useStore((s) => s.flowMenu);
  const ref = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [top, setTop] = useState(0);
  const [pick, setPick] = useState<string | null>(null); // 대상을 고르는 중인 선(handle)
  const [query, setQuery] = useState('');
  const [cur, setCur] = useState(0);

  // 다음 흐름 줄 높이에 맞추되, 옆에 붙은 카드(연출 입력칸, 대사 설정)와 겹치면 그 아래로 내린다
  const place = () => {
    const box = ref.current?.parentElement;
    const exit = box?.querySelector('.box-exit') as HTMLElement | null;
    if (!box || !exit) return;
    let t = exit.offsetTop;
    const side = box.querySelector('.side-r') as HTMLElement | null;
    if (side?.offsetParent) {
      // 카드가 움직이는 중이어도 도착할 자리로 잰다
      const z = box.getBoundingClientRect().height / (box.offsetHeight || 1);
      const base = (side.offsetParent.getBoundingClientRect().top - box.getBoundingClientRect().top) / z;
      t = Math.max(t, base + parseFloat(side.style.top || '0') + side.offsetHeight + 8);
    }
    setTop(t);
  };
  useLayoutEffect(place);
  // 쓰는 줄을 옮기면 이 창은 다시 그려지지 않아서, 상자 안이 바뀌는 것을 지켜본다
  useEffect(() => {
    const box = ref.current?.parentElement;
    if (!box) return;
    const watch = new MutationObserver(place);
    watch.observe(box, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
    return () => watch.disconnect();
  }, []);

  // 들어오면 키를 받을 칸에 커서를 둔다. 나갈 때는 쓰던 글자 칸으로 돌려보낸다
  const back = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (active) {
      const el = document.activeElement as HTMLElement | null;
      if (el && el !== input.current && el.id) back.current = el.id;
      setPick(null);
      setQuery('');
      setCur(0);
      input.current?.focus();
    }
  }, [active]);

  useLayoutEffect(() => {
    if (active) input.current?.focus();
  }, [pick, active]);

  const close = (refocus = true) => {
    useStore.setState({ flowMenu: false });
    if (refocus && back.current) focusField(back.current);
  };

  const name = (id: string | null) => {
    const n = id ? project.nodes.find((x) => x.id === id) : null;
    if (!n) return '(연결 안 됨)';
    const g = project.labels.find((l) => l.id === n.group);
    return `${n.title || n.id} · ${g?.name ?? '?'}`;
  };
  const linkName = (h: string) => {
    if (h === 'next') return '다음';
    if (h === 'call') return 'call 대상';
    if (h === 'then') return '복귀 후';
    const c = b.exit.type === 'menu' ? b.exit.choices.find((x) => 'c:' + x.id === h) : null;
    return `◆ ${c?.text || '(빈 선택지)'}`;
  };

  // 지금 보여 줄 항목들
  let items: Item[] = [];
  if (!pick) {
    items = TYPES.map(([t, label], i) => ({
      key: 'type:' + t,
      label,
      on: b.exit.type === t,
      section: i === 0 ? '흐름 종류' : undefined,
      run: () => update((p) => ops.setExitType(ops.findBox(p, b.id)!, t)),
    }));
    ops.exitLinks(b).forEach((l, i) =>
      items.push({
        key: 'link:' + l.handle,
        label: `${linkName(l.handle)} → ${name(l.target)}`,
        hint: '고르기 ›',
        section: i === 0 ? '이어지는 곳' : undefined,
        run: () => (setPick(l.handle), setQuery(''), setCur(0)),
      }),
    );
    if (b.exit.type === 'menu')
      items.push({
        key: 'addChoice',
        label: '＋ 선택지 추가',
        section: ops.exitLinks(b).length ? undefined : '이어지는 곳',
        run: () => {
          const c = ops.newChoice();
          update((p) => void (ops.findBox(p, b.id)!.exit as any).choices.push(c));
          close(false);
          focusField('in-' + c.id); // 상자 안의 새 선택지 칸에서 문구를 쓴다
        },
      });
    const next = ops.fallTarget(b);
    const firstAct = items.length;
    if (next && project.nodes.some((n) => n.id === next))
      items.push({ key: 'go', label: `→ "${name(next)}" 이어 쓰기`, hint: keyOf('nextBox'), run: () => (close(false), goNextBox(b.id)) });
    for (const l of ops.exitLinks(b).filter((l) => !l.target))
      items.push({ key: 'new:' + l.handle, label: `＋ ${linkName(l.handle)} → 새 상자에 이어 쓰기`, run: () => (close(false), continueInNewBox(b.id, l.handle)) });
    if (items[firstAct]) items[firstAct].section = '바로 가기';
  } else {
    const q = query.trim().toLowerCase();
    const set = (target: string | null) => (update((p) => ops.setLink(ops.findBox(p, b.id)!, pick, target)), setPick(null), setCur(0));
    const target = ops.exitLinks(b).find((l) => l.handle === pick)?.target ?? null;
    items = [
      { key: 'new', label: '＋ 새 상자에 이어 쓰기', section: `${linkName(pick)} →`, run: () => (close(false), continueInNewBox(b.id, pick)) },
      { key: 'none', label: '(연결 안 됨)', on: !target, run: () => set(null) },
      ...project.nodes
        .filter((n) => !q || name(n.id).toLowerCase().includes(q))
        .map((n) => ({ key: n.id, label: name(n.id) + (n.id === b.id ? ' (자기 자신)' : ''), on: n.id === target, run: () => set(n.id) })),
    ];
  }

  const at = Math.min(cur, items.length - 1);

  // 고른 항목이 보이게 굴린다
  useLayoutEffect(() => {
    if (active) ref.current?.querySelector('.fm-item.cur')?.scrollIntoView({ block: 'nearest' });
  });

  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    // 같은 단축키로 다시 누르면 글로 돌아간다
    if (hit(e, 'flowMenu')) {
      e.preventDefault();
      e.stopPropagation();
      return close();
    }
    if (k === 'ArrowDown' || k === 'ArrowUp') {
      e.preventDefault();
      setCur((at + (k === 'ArrowDown' ? 1 : -1) + items.length) % items.length);
    } else if (k === 'Enter' || (k === 'ArrowRight' && !query)) {
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      items[at]?.run();
    } else if (k === 'Escape' || (k === 'ArrowLeft' && !query) || (k === 'Backspace' && !query)) {
      e.preventDefault();
      e.stopPropagation();
      if (pick) (setPick(null), setCur(0));
      else close();
    }
  };

  return (
    <div className={'side side-flow fm nodrag' + (active ? ' active' : '')} style={{ top }} ref={ref}>
      <div className="side-title">
        다음 흐름 <span className="fm-key">{keyOf('flowMenu')}</span>
      </div>
      {/* 키를 받는 칸. 대상을 고를 때는 찾기 칸으로 보이고, 첫 단계에서는 숨어서 키만 받는다 */}
      <input
        ref={input}
        className={pick ? 'fm-query' : 'fm-keys'}
        readOnly={!pick}
        value={pick ? query : ''}
        placeholder="상자 이름으로 찾기"
        aria-label="다음 흐름 메뉴"
        onChange={(e) => (setQuery(e.target.value), setCur(2))}
        onKeyDown={onKey}
        onBlur={() => setTimeout(() => ref.current?.contains(document.activeElement) || useStore.setState({ flowMenu: false }), 0)}
      />
      <div className="fm-list">
        {items.map((it, i) => (
          <div key={it.key}>
            {it.section && <div className="fm-sec">{it.section}</div>}
            <div
              className={'fm-item' + (active && i === at ? ' cur' : '') + (it.on ? ' on' : '')}
              onMouseEnter={() => active && setCur(i)}
              onClick={() => it.run()}
            >
              <span className="fm-dot">{it.on ? '●' : ''}</span>
              <span className="fm-label">{it.label}</span>
              {it.hint && <span className="fm-hint">{it.hint}</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="tip fm-help">
        {active ? '↑↓ 고르기 · Enter 정하기 · ← 뒤로 · Esc 글로 돌아가기' : `${keyOf('flowMenu')}: 키보드로 고르기 · ${keyOf('nextBox')}: 다음 상자로 이어 쓰기`}
      </div>
    </div>
  );
}
