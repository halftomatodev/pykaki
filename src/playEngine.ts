// 테스트 플레이 엔진. 내보낸 .rpy와 같은 규칙(jump/menu/call/return)으로 흐름을 따라간다.
import type { Choice, Line, Project } from './types';
import { isStage, stageCode } from './stage';

export interface PState {
  node: string | null;
  line: number;
  stack: { from: string; to: string | null }[]; // call 복귀 위치
  menu: Choice[] | null;
  show: Line | null;
  showNode: string | null;
  commands: string[];
  ended: null | 'end' | 'broken' | 'missing' | 'loop';
  brokenAt: string | null;
  visited: string[];
  edges: string[];
}

function move(s: PState, from: string, to: string) {
  s.edges = [...s.edges, from + '>' + to];
  s.node = to;
  s.line = 0;
  if (!s.visited.includes(to)) s.visited = [...s.visited, to];
}

export function advance(p: Project, s0: PState): PState {
  const s: PState = { ...s0, stack: [...s0.stack], menu: null };
  const byId = new Map(p.nodes.map((n) => [n.id, n]));
  for (let guard = 0; guard < 5000; guard++) {
    if (!s.node) return { ...s, ended: 'broken' };
    const b = byId.get(s.node);
    if (!b) return { ...s, ended: 'missing' };
    if (s.line < b.lines.length) {
      const l = b.lines[s.line++];
      if (l.type === 'note') continue;
      if (l.type === 'command' || isStage(l.type)) {
        const c = l.type === 'command' ? l.text.split('\n')[0] : stageCode(l).code;
        if (c) s.commands = [...s.commands, c].slice(-6);
        continue;
      }
      s.show = l;
      s.showNode = b.id;
      return s;
    }
    const e = b.exit;
    if (e.type === 'next') {
      if (!e.target) return { ...s, ended: 'broken', brokenAt: b.id };
      move(s, b.id, e.target);
    } else if (e.type === 'menu') {
      if (!e.choices.length) return { ...s, ended: 'broken', brokenAt: b.id };
      s.menu = e.choices;
      return s;
    } else if (e.type === 'call') {
      if (!e.target) return { ...s, ended: 'broken', brokenAt: b.id };
      s.stack.push({ from: b.id, to: e.then });
      move(s, b.id, e.target);
    } else {
      const r = s.stack.pop();
      if (!r) return { ...s, ended: 'end' };
      if (r.to) move(s, r.from, r.to);
      else s.line = b.lines.length; // 복귀 후 이어질 곳이 없으면 한 번 더 return
    }
  }
  return { ...s, ended: 'loop' };
}

export function start(p: Project, from: string | null): PState {
  const s: PState = {
    node: from, line: 0, stack: [], menu: null, show: null, showNode: null, commands: [],
    ended: null, brokenAt: null, visited: from ? [from] : [], edges: [],
  };
  return advance(p, s);
}

export function choose(p: Project, s: PState, c: Choice): PState {
  const n: PState = { ...s, menu: null };
  if (!c.target) return { ...n, ended: 'broken', brokenAt: s.node };
  move(n, s.node!, c.target);
  return advance(p, n);
}
