// 프로젝트를 고치는 함수들. 모두 store.update() 안에서 복사본(draft)에 대해 호출한다.
import type { BoxNode, Choice, ExitType, Project } from './types';
import { PALETTE, uid } from './util';

export type LinkKind = 'next' | 'choice' | 'call' | 'then';
export interface Link { handle: string; target: string | null; kind: LinkKind }

// 상자에서 나가는 선 목록. handle은 React Flow의 sourceHandle id와 같다.
export function exitLinks(b: BoxNode): Link[] {
  const e = b.exit;
  if (e.type === 'next') return [{ handle: 'next', target: e.target, kind: 'next' }];
  if (e.type === 'menu') return e.choices.map((c) => ({ handle: 'c:' + c.id, target: c.target, kind: 'choice' as const }));
  if (e.type === 'call')
    return [
      { handle: 'call', target: e.target, kind: 'call' },
      { handle: 'then', target: e.then, kind: 'then' },
    ];
  return [];
}

// 흐름상 "바로 다음"으로 이어지는 상자 (jump 없이 이어 쓸 수 있는 대상)
export function fallTarget(b: BoxNode) {
  if (b.exit.type === 'next') return b.exit.target;
  if (b.exit.type === 'call') return b.exit.then;
  return null;
}

export function setLink(b: BoxNode, handle: string, target: string | null) {
  const e = b.exit;
  if (handle === 'next' && e.type === 'next') e.target = target;
  else if (handle === 'call' && e.type === 'call') e.target = target;
  else if (handle === 'then' && e.type === 'call') e.then = target;
  else if (handle.startsWith('c:') && e.type === 'menu') {
    const c = e.choices.find((c) => 'c:' + c.id === handle);
    if (c) c.target = target;
  }
}

export const findBox = (p: Project, id: string) => p.nodes.find((n) => n.id === id);

export function connect(p: Project, src: string, handle: string | null | undefined, target: string | null) {
  const b = findBox(p, src);
  if (b) setLink(b, handle ?? 'next', target);
}

export const newChoice = (target: string | null = null, text = ''): Choice => ({
  id: uid('c'), text, target, mode: 'jump', condition: null, actions: [],
});

export function addGroup(p: Project, name?: string) {
  let i = p.labels.length + 1;
  while (p.labels.some((l) => l.name === 'scene_' + i)) i++;
  const g = { id: uid('g'), name: name ?? 'scene_' + i, title: '', color: PALETTE[p.labels.length % PALETTE.length], entry: null };
  p.labels.push(g);
  return g.id;
}

export function addBox(p: Project, pos: { x: number; y: number }, groupId?: string | null) {
  let gid = groupId && p.labels.some((l) => l.id === groupId) ? groupId : p.labels[0]?.id;
  if (!gid) gid = addGroup(p);
  const b: BoxNode = {
    id: uid('n'),
    group: gid,
    title: '',
    pos: { x: Math.round(pos.x), y: Math.round(pos.y) },
    lines: [{ id: uid('l'), type: 'narration', text: '' }],
    exit: { type: 'next', target: null },
  };
  p.nodes.push(b);
  const g = p.labels.find((l) => l.id === gid)!;
  if (!g.entry) g.entry = b.id;
  if (!p.project.startNode) p.project.startNode = b.id;
  return b.id;
}

// 각 label의 첫 상자가 실제로 그 label에 있는지 맞춘다
export function fixEntries(p: Project) {
  for (const g of p.labels) {
    if (!g.entry || !p.nodes.some((n) => n.id === g.entry && n.group === g.id))
      g.entry = p.nodes.find((n) => n.group === g.id)?.id ?? null;
  }
}

export function setGroup(p: Project, ids: string[], gid: string) {
  for (const n of p.nodes) if (ids.includes(n.id)) n.group = gid;
  fixEntries(p);
}

export function deleteBoxes(p: Project, ids: string[]) {
  const set = new Set(ids);
  p.nodes = p.nodes.filter((n) => !set.has(n.id));
  for (const n of p.nodes) for (const l of exitLinks(n)) if (l.target && set.has(l.target)) setLink(n, l.handle, null);
  if (p.project.startNode && set.has(p.project.startNode)) p.project.startNode = p.nodes[0]?.id ?? null;
  fixEntries(p);
}

export function setExitType(b: BoxNode, t: ExitType) {
  const first = exitLinks(b).map((l) => l.target).find(Boolean) ?? null;
  if (t === 'next') b.exit = { type: 'next', target: first };
  else if (t === 'menu') b.exit = { type: 'menu', choices: [newChoice(first), newChoice(null)] };
  else if (t === 'call') b.exit = { type: 'call', target: first, then: null };
  else b.exit = { type: 'return' };
}

// 선 더블클릭: 다음(jump) ↔ call 전환
export function toggleCall(p: Project, src: string, handle: string | null | undefined) {
  const b = findBox(p, src);
  if (!b) return;
  if (handle === 'next' && b.exit.type === 'next') b.exit = { type: 'call', target: b.exit.target, then: null };
  else if (handle === 'call' && b.exit.type === 'call') b.exit = { type: 'next', target: b.exit.target };
}
