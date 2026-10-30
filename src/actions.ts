// 툴바와 단축키가 함께 쓰는 동작
import { flushSync } from 'react-dom';
import type { ReactFlowInstance } from '@xyflow/react';
import { useStore } from './store';
import { layoutAll, layoutSubset } from './layout';
import * as ops from './ops';
import { uid } from './util';
import { keyOf } from './prefs';

export type LayoutMode = 'all' | 'label' | 'selection';

export async function runLayout(rf: ReactFlowInstance<any, any>, mode: LayoutMode) {
  const s = useStore.getState();
  const p = s.project;
  const sizes = new Map(rf.getNodes().map((n) => [n.id, { w: n.measured?.width ?? 250, h: n.measured?.height ?? 120 }]));
  const dir = p.layout.direction;
  let pos = new Map<string, { x: number; y: number }>();
  try {
    if (mode === 'all') pos = await layoutAll(p, sizes, dir);
    else if (mode === 'selection') {
      if (s.selectedIds.length < 2) return s.say('정렬할 상자를 2개 이상 선택해 주세요 (Shift+드래그)');
      pos = await layoutSubset(p, sizes, s.selectedIds, dir);
    } else {
      const groups = new Set(s.selectedIds.map((id) => ops.findBox(p, id)?.group));
      if (!groups.size) return s.say('정렬할 label의 상자를 하나 선택해 주세요');
      for (const g of groups) {
        const ids = p.nodes.filter((n) => n.group === g).map((n) => n.id);
        if (ids.length > 1) for (const [k, v] of await layoutSubset(p, sizes, ids, dir)) pos.set(k, v);
      }
    }
  } catch (e: any) {
    return alert('정렬 실패: ' + e.message);
  }
  useStore.setState({ animating: true });
  s.update((d) => {
    for (const n of d.nodes) {
      const q = pos.get(n.id);
      if (q) n.pos = q;
    }
  });
  setTimeout(() => useStore.setState({ animating: false }), 450);
  if (mode === 'all') setTimeout(() => s.focusNodes(p.nodes.map((n) => n.id)), 460);
}

export function currentGroup() {
  const s = useStore.getState();
  const sel = s.selectedIds[0];
  return (sel && ops.findBox(s.project, sel)?.group) || s.project.labels[0]?.id || null;
}

export function addBoxAt(pos: { x: number; y: number }, group?: string | null) {
  const s = useStore.getState();
  let id = '';
  s.update((p) => {
    id = ops.addBox(p, pos, group ?? currentGroup());
  });
  s.select([id]);
  useStore.setState({ tab: 'edit', focusLineId: useStore.getState().project.nodes.find((n) => n.id === id)?.lines[0]?.id ?? null });
  return id;
}

function focusNow(elId: string) {
  const el = document.getElementById(elId) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!el) return false;
  el.focus();
  // 연출 줄은 줄 자체(div)가 포커스를 받아서 커서 위치가 없다
  if ('setSelectionRange' in el) el.setSelectionRange(el.value.length, el.value.length);
  return true;
}

// 입력칸이 화면에 생긴 뒤 커서를 끝으로 옮긴다
export function focusField(elId: string) {
  setTimeout(() => focusNow(elId), 60);
}

// 새 칸을 만드는 변경을 바로 화면에 그리고 곧장 커서를 옮긴다 (빨리 이어 쳐도 글자가 앞 칸에 들어가지 않게)
export function changeThenFocus(change: () => void, elId: string) {
  flushSync(change);
  if (!focusNow(elId)) focusField(elId);
}

// 상자 더블클릭: 상자 안에서 바로 편집. 누른 곳(제목/대사 줄/선택지)의 입력칸으로 커서를 옮긴다
export function editBox(boxId: string, part: string | null) {
  const s = useStore.getState();
  const b = ops.findBox(s.project, boxId);
  if (!b) return;
  let target = part;
  if (!target) {
    if (!b.lines.length) {
      const id = uid('l');
      s.update((p) => void ops.findBox(p, boxId)!.lines.push({ id, type: 'narration', text: '' }));
      target = id;
    } else target = b.lines[b.lines.length - 1].id;
  }
  s.select([boxId]);
  useStore.setState({ inlineEdit: boxId, flowMenu: false });
  focusField(target === 'title' ? 'in-title-' + boxId : 'in-' + target);
}

export function addBoxCenter(rf: ReactFlowInstance<any, any>) {
  const el = document.querySelector('.canvas')!.getBoundingClientRect();
  const pos = rf.screenToFlowPosition({ x: el.left + el.width / 2, y: el.top + el.height / 2 });
  addBoxAt({ x: pos.x - 125, y: pos.y - 50 });
}

export function toggleFocus() {
  const on = !useStore.getState().focusMode;
  useStore.setState({ focusMode: on });
  if (on) useStore.getState().say(`집중 모드 · ${keyOf('focus')}로 돌아와요`);
}

// 상자 크기: 화면에 그려진 크기(확대 전). 없으면 기본값
function boxSize(id: string) {
  const el = document.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement | null;
  return { w: el?.offsetWidth ?? 250, h: el?.offsetHeight ?? 150 };
}

// 아직 이어지지 않은 선(handle)에 새 상자를 만들어 잇고, 그 상자에서 바로 글을 쓴다
export function continueInNewBox(fromId: string, handle: string) {
  const s = useStore.getState();
  const b = ops.findBox(s.project, fromId);
  if (!b) return;
  const links = ops.exitLinks(b);
  const i = Math.max(0, links.findIndex((l) => l.handle === handle));
  const { w, h } = boxSize(fromId);
  const tb = s.project.layout.direction === 'TB';
  // 선택지가 여럿이면 옆으로 나란히 놓는다
  const pos = tb ? { x: b.pos.x + (i - (links.length - 1) / 2) * (w + 40), y: b.pos.y + h + 90 } : { x: b.pos.x + w + 110, y: b.pos.y + i * 180 };
  // 다른 상자와 겹치면 흐름 방향으로 비켜 놓는다
  const W = 250;
  const H = 120;
  const hits = () =>
    s.project.nodes.some((n) => {
      const sz = boxSize(n.id);
      return pos.x < n.pos.x + sz.w + 20 && pos.x + W + 20 > n.pos.x && pos.y < n.pos.y + sz.h + 20 && pos.y + H + 20 > n.pos.y;
    });
  for (let k = 0; k < 40 && hits(); k++) tb ? (pos.y += 60) : (pos.x += 60);
  let id = '';
  s.update((p) => {
    id = ops.addBox(p, pos, b.group);
    ops.connect(p, fromId, handle, id);
  });
  editBox(id, null);
}

// 글을 쓰다가 다음 상자로: 이어진 상자가 있으면 그리로, 없으면 새 상자를 만들어 잇는다
export function goNextBox(fromId: string) {
  const s = useStore.getState();
  const b = ops.findBox(s.project, fromId);
  if (!b) return;
  const next = ops.fallTarget(b);
  if (next && ops.findBox(s.project, next)) return editBox(next, null);
  if (b.exit.type === 'next') return continueInNewBox(fromId, 'next');
  if (b.exit.type === 'call') return continueInNewBox(fromId, 'then');
  s.say(b.exit.type === 'menu' ? '선택지는 오른쪽 "다음 흐름"에서 골라서 이어 써요' : '이 상자는 여기서 끝나요 (return)');
}
