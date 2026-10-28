// 자동 정렬 (ELK layered: 흐름 방향으로 층을 나눠 배치)
// @ts-ignore - 번들 버전에는 타입 선언이 따로 없다
import ELK from 'elkjs/lib/elk.bundled.js';
import type { Project } from './types';
import { exitLinks } from './ops';

const elk = new ELK();
type Size = { w: number; h: number };
type Pos = { x: number; y: number };

const base = (dir: 'TB' | 'LR') => ({
  'elk.algorithm': 'layered',
  'elk.direction': dir === 'TB' ? 'DOWN' : 'RIGHT',
  'elk.layered.spacing.nodeNodeBetweenLayers': '70',
  'elk.spacing.nodeNode': '50',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES', // 선택지 순서대로 좌→우
});

// 되돌아가는 선(루프): 시작부터 깊이 우선으로 따라가다 지금 경로 위의 상자로 돌아가는 선.
// 정렬 계산에서 빼야 시작 상자가 맨 위에 오고 배치가 꼬이지 않는다.
function backEdges(p: Project) {
  const byId = new Map(p.nodes.map((n) => [n.id, n]));
  const state = new Map<string, 1 | 2>(); // 1: 경로 위, 2: 끝남
  const back = new Set<string>();
  const dfs = (id: string) => {
    state.set(id, 1);
    for (const l of exitLinks(byId.get(id)!)) {
      if (!l.target || !byId.has(l.target)) continue;
      const s = state.get(l.target);
      if (s === 1) back.add(id + '>' + l.target);
      else if (!s) dfs(l.target);
    }
    state.set(id, 2);
  };
  for (const r of [p.project.startNode, ...p.labels.map((g) => g.entry), ...p.nodes.map((n) => n.id)])
    if (r && byId.has(r) && !state.has(r)) dfs(r);
  return back;
}

// 시작 상자부터 흐름을 따라간 순서 (ELK에 이 순서로 넘겨야 위→아래가 흐름대로 나온다)
function flowOrder(p: Project) {
  const byId = new Map(p.nodes.map((n) => [n.id, n]));
  const order: string[] = [];
  const seen = new Set<string>();
  const roots = [p.project.startNode, ...p.labels.map((g) => g.entry), ...p.nodes.map((n) => n.id)];
  for (const r of roots) {
    if (!r || seen.has(r) || !byId.has(r)) continue;
    seen.add(r);
    const q = [r];
    while (q.length) {
      const id = q.shift()!;
      order.push(id);
      for (const l of exitLinks(byId.get(id)!))
        if (l.target && byId.has(l.target) && !seen.has(l.target)) (seen.add(l.target), q.push(l.target));
    }
  }
  const rank = new Map(order.map((id, i) => [id, i]));
  return (ids: string[]) => [...ids].sort((a, b) => rank.get(a)! - rank.get(b)!);
}

function edgesOf(p: Project, scope: Set<string>) {
  const back = backEdges(p);
  const res: { id: string; sources: string[]; targets: string[] }[] = [];
  for (const b of flowOrder(p)(p.nodes.map((n) => n.id)).map((id) => p.nodes.find((n) => n.id === id)!)) {
    if (!scope.has(b.id)) continue;
    for (const l of exitLinks(b))
      if (l.target && scope.has(l.target) && !back.has(b.id + '>' + l.target))
        res.push({ id: 'e' + res.length, sources: [b.id], targets: [l.target] });
  }
  return res;
}

const child = (id: string, sizes: Map<string, Size>) => ({ id, width: sizes.get(id)?.w ?? 250, height: sizes.get(id)?.h ?? 120 });

// 전체 정렬: 같은 label 상자를 한 덩어리로 묶어 배치
export async function layoutAll(p: Project, sizes: Map<string, Size>, dir: 'TB' | 'LR') {
  const sort = flowOrder(p);
  const rank = new Map(sort(p.nodes.map((n) => n.id)).map((id, i) => [id, i]));
  const firstRank = (gid: string) => Math.min(...p.nodes.filter((n) => n.group === gid).map((n) => rank.get(n.id)!));
  const groups = p.labels
    .map((g) => ({
      id: 'G:' + g.id,
      layoutOptions: { 'elk.padding': '[top=56,left=34,bottom=34,right=34]' },
      children: sort(p.nodes.filter((n) => n.group === g.id).map((n) => n.id)).map((id) => child(id, sizes)),
    }))
    .filter((g) => g.children.length)
    .sort((a, b) => firstRank(a.id.slice(2)) - firstRank(b.id.slice(2)));
  const res = await elk.layout({
    id: 'root',
    layoutOptions: { ...base(dir), 'elk.hierarchyHandling': 'INCLUDE_CHILDREN' },
    children: groups,
    edges: edgesOf(p, new Set(p.nodes.map((n) => n.id))),
  });
  const out = new Map<string, Pos>();
  for (const g of res.children ?? [])
    for (const c of g.children ?? []) out.set(c.id, { x: Math.round((g.x ?? 0) + (c.x ?? 0)), y: Math.round((g.y ?? 0) + (c.y ?? 0)) });
  return out;
}

// 일부만 정렬: 고른 상자들만 배치하고, 왼쪽 위 위치는 그대로 둔다
export async function layoutSubset(p: Project, sizes: Map<string, Size>, ids: string[], dir: 'TB' | 'LR') {
  const set = new Set(ids);
  const ns = p.nodes.filter((n) => set.has(n.id));
  const minX = Math.min(...ns.map((n) => n.pos.x));
  const minY = Math.min(...ns.map((n) => n.pos.y));
  const res = await elk.layout({ id: 'root', layoutOptions: base(dir), children: flowOrder(p)(ids).map((id) => child(id, sizes)), edges: edgesOf(p, set) });
  const cs = res.children ?? [];
  const rx = Math.min(...cs.map((c: any) => c.x ?? 0));
  const ry = Math.min(...cs.map((c: any) => c.y ?? 0));
  const out = new Map<string, Pos>();
  for (const c of cs) out.set(c.id, { x: Math.round(minX + (c.x ?? 0) - rx), y: Math.round(minY + (c.y ?? 0) - ry) });
  return out;
}
