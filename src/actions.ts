// 툴바와 단축키가 함께 쓰는 동작
import type { ReactFlowInstance } from '@xyflow/react';
import { useStore } from './store';
import { layoutAll, layoutSubset } from './layout';
import * as ops from './ops';
import { uid } from './util';

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

// 상자 더블클릭: 편집 탭을 열고 누른 곳(제목/대사 줄/선택지)의 입력칸으로 커서를 옮긴다
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
  useStore.setState({ tab: 'edit' });
  setTimeout(() => {
    const el = document.getElementById('ed-' + target) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    el.scrollIntoView({ block: 'nearest' });
  }, 60);
}

export function addBoxCenter(rf: ReactFlowInstance<any, any>) {
  const el = document.querySelector('.canvas')!.getBoundingClientRect();
  const pos = rf.screenToFlowPosition({ x: el.left + el.width / 2, y: el.top + el.height / 2 });
  addBoxAt({ x: pos.x - 125, y: pos.y - 50 });
}
