// 테스트 플레이 엔진. 내보낸 .rpy와 같은 규칙(jump/menu/call/return)으로 흐름을 따라간다.
// 화면(배경, 그림, 소리)도 상태에 담아 둬서 뒤로 가기와 건너뛰기가 그대로 맞는다.
import type { Choice, Line, Project } from './types';
import { imageName, isStage, stageCode } from './stage';
import { codeToLine } from './inbox';
import { exitLinks } from './ops';

export interface Sprite {
  key: string; // 화면에 새로 나올 때마다 달라진다. 효과를 다시 돌리는 기준
  tag: string;
  name: string;
  box: string | null; // 나온 상자. stage_layout.rpy의 "이 상자에서만" 위치를 찾을 때 쓴다
  at?: string; // left | right
  pos?: [number, number]; // stage.pos(x, y)
  trans?: string; // 나오거나 사라질 때의 전환
}

export interface PStage {
  bg: Sprite | null;
  sprites: Sprite[];
  leaving: Sprite[]; // 이번 걸음에 사라지는 중인 것
  music: string | null;
  sound: string | null;
  soundSeq: number;
  fx: string | null; // 화면 효과 이름. 이름만 보여 준다
  fade: string | null; // 검게 페이드 효과의 key
  wait: number; // 전환이 끝날 때까지 글자를 기다릴 초
  seq: number;
}

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
  stage: PStage;
}

const emptyStage = (): PStage => ({ bg: null, sprites: [], leaving: [], music: null, sound: null, soundSeq: 0, fx: null, fade: null, wait: 0, seq: 0 });

// 전환 이름 → 효과 종류와 초. stage.move("inleft", 0.8), stage.ease(...), stage.zoom("in", 0.8)도 읽는다
export function transInfo(t?: string): { kind: string; dur: number } | null {
  if (!t) return null;
  if (t === 'dissolve') return { kind: 'dissolve', dur: 0.5 };
  if (t === 'fade') return { kind: 'fade', dur: 1 };
  const m = /^stage\.(move|ease|zoom)\(\s*"(\w*)"(?:\s*,\s*([\d.]+))?/.exec(t);
  if (!m) return null;
  const dur = m[3] ? Number(m[3]) : 0.5;
  if (m[1] === 'zoom') return { kind: 'zoom' + m[2], dur };
  return m[2] ? { kind: m[2], dur } : null;
}

const noteTrans = (st: PStage, t?: string) => {
  const info = transInfo(t);
  if (!info) return;
  st.wait += info.dur;
  if (info.kind === 'fade') st.fade = 'f' + st.seq;
};

function putImage(st: PStage, name: string, box: string | null, o: { at?: string; pos?: [number, number]; trans?: string }) {
  st.seq++;
  const tag = name.split(' ')[0];
  noteTrans(st, o.trans);
  const fresh: Sprite = { key: 's' + st.seq, tag, name, box, ...o };
  if (tag === 'bg') {
    if (st.bg?.name === name) return;
    if (st.bg) st.leaving.push({ ...st.bg, trans: o.trans });
    st.bg = fresh;
    return;
  }
  const i = st.sprites.findIndex((s) => s.tag === tag);
  if (i < 0) return void st.sprites.push(fresh);
  const cur = st.sprites[i];
  // 같은 그림의 표정만 바꾸는 줄은 자리를 잇는다. 원고에 자리를 적으면 그 자리로
  const placed = o.at || o.pos ? {} : { at: cur.at, pos: cur.pos };
  if (cur.name === name && !o.at && !o.pos) return;
  if (cur.name !== name && o.trans) st.leaving.push({ ...cur, trans: o.trans });
  st.sprites[i] = { ...fresh, ...placed, key: o.trans ? fresh.key : cur.key };
}

function removeImage(st: PStage, tag: string, trans?: string) {
  st.seq++;
  noteTrans(st, trans);
  if (tag === 'bg') {
    if (st.bg && trans) st.leaving.push({ ...st.bg, trans });
    st.bg = null;
    return;
  }
  const i = st.sprites.findIndex((s) => s.tag === tag);
  if (i < 0) return;
  if (trans) st.leaving.push({ ...st.sprites[i], key: 'x' + st.seq, trans });
  st.sprites.splice(i, 1);
}

// 줄 하나를 화면 상태에 넣는다. 흉내 내지 못하는 명령이면 false
function applyLine(st: PStage, l: Line, box: string | null): boolean {
  switch (l.type) {
    case 'scene':
      st.seq++;
      noteTrans(st, l.trans);
      if (l.trans) st.leaving.push(...st.sprites.map((s) => ({ ...s, key: 'x' + s.key, trans: l.trans })));
      st.sprites = [];
      if (l.image?.trim()) {
        if (l.trans && st.bg) st.leaving.unshift({ ...st.bg, key: 'x' + st.bg.key, trans: l.trans });
        st.bg = { key: 's' + st.seq, tag: 'bg', name: 'bg ' + l.image.trim().replace(/\s+/g, ' '), box, trans: l.trans };
      } else {
        if (l.trans && st.bg) st.leaving.unshift({ ...st.bg, key: 'x' + st.bg.key, trans: l.trans });
        st.bg = null;
      }
      return true;
    case 'show': {
      const name = imageName(l);
      if (!name) return true;
      const cur = st.sprites.find((s) => s.tag === name.split(' ')[0]);
      // show mina 처럼 표정 없이 적으면 지금 표정을 잇는다
      putImage(st, cur && !name.includes(' ') ? cur.name : name, box, { at: l.at, trans: l.trans });
      return true;
    }
    case 'hide': {
      const k = l.kind ?? 'char';
      const tag = k === 'bg' ? 'bg' : k === 'char' ? l.who : l.image?.trim().split(/\s+/)[0];
      if (tag) removeImage(st, tag, l.trans);
      return true;
    }
    case 'music':
      if (l.stop) st.music = null;
      else if (l.file?.trim()) st.music = l.file.trim();
      return true;
    case 'sound':
      if (l.file?.trim()) (st.sound = l.file.trim(), st.soundSeq++);
      return true;
    case 'fx':
      if (l.fx?.fx) st.fx = l.fx.fx === 'default' || l.fx.fx === 'none' ? null : l.fx.fx;
      return true;
  }
  return false;
}

// 직접 명령 한 줄을 흉내 낸다. 그림, 소리, 화면 효과만 안다
function applyCommand(st: PStage, code: string, box: string | null, p: Project): boolean {
  let m = /screen_fx\.use\(\s*"(\w+)"/.exec(code);
  if (m) return (st.fx = m[1] === 'none' ? null : m[1]), true;
  if (/screen_fx\.clear\(/.test(code)) return (st.fx = null), true;
  m = /^(show\s+.*?)\s+at\s+stage\.pos\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)[^)]*\)(.*)$/.exec(code);
  const pos: [number, number] | undefined = m ? [Number(m[2]), Number(m[3])] : undefined;
  const l = codeToLine(m ? m[1] + m[4] : code, 'cmd', p);
  if (l.type === 'command') return false;
  if (pos) {
    const name = imageName(l);
    if (!name) return false;
    putImage(st, name, box, { pos, trans: l.trans });
    return true;
  }
  return applyLine(st, l, box);
}

function applyAny(st: PStage, l: Line, box: string | null, p: Project, onUnknown?: (c: string) => void) {
  if (l.type === 'command') {
    for (const c of l.text.split('\n')) if (c.trim() && !applyCommand(st, c.trim(), box, p)) onUnknown?.(c.trim());
    return;
  }
  if (!applyLine(st, l, box)) onUnknown?.(stageCode(l).code ?? '');
}

const cloneStage = (st: PStage): PStage => ({ ...st, sprites: [...st.sprites], leaving: [], fade: null, wait: 0 });

function move(s: PState, from: string, to: string) {
  s.edges = [...s.edges, from + '>' + to];
  s.node = to;
  s.line = 0;
  if (!s.visited.includes(to)) s.visited = [...s.visited, to];
}

export function advance(p: Project, s0: PState): PState {
  const s: PState = { ...s0, stack: [...s0.stack], menu: null, stage: cloneStage(s0.stage) };
  const byId = new Map(p.nodes.map((n) => [n.id, n]));
  for (let guard = 0; guard < 5000; guard++) {
    if (!s.node) return { ...s, ended: 'broken' };
    const b = byId.get(s.node);
    if (!b) return { ...s, ended: 'missing' };
    if (s.line < b.lines.length) {
      const l = b.lines[s.line++];
      if (l.type === 'note') continue;
      if (l.type === 'command' || isStage(l.type)) {
        applyAny(s.stage, l, b.id, p, (c) => (s.commands = [...s.commands, c].slice(-6)));
        continue;
      }
      if (l.fx?.fx) s.stage.fx = l.fx.fx === 'default' || l.fx.fx === 'none' ? null : l.fx.fx;
      // 대사의 표정은 화면에 떠 있는 그 캐릭터 그림을 바꾼다
      if (l.type === 'say' && l.who && l.attr?.trim() && s.stage.sprites.some((x) => x.tag === l.who)) putImage(s.stage, l.who + ' ' + l.attr.trim(), b.id, {});
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

// 상자 가운데서 시작할 때: 시작 상자에서 거기까지 가장 짧은 길을 따라가며 화면만 채운다
function seedStage(p: Project, box: string, lineIndex: number): PStage {
  const st = emptyStage();
  const byId = new Map(p.nodes.map((n) => [n.id, n]));
  const startId = p.project.startNode;
  const prev = new Map<string, string | null>();
  if (startId && byId.has(startId)) {
    prev.set(startId, null);
    const queue = [startId];
    while (queue.length && !prev.has(box)) {
      const cur = queue.shift()!;
      for (const l of exitLinks(byId.get(cur)!)) {
        if (l.target && byId.has(l.target) && !prev.has(l.target)) {
          prev.set(l.target, cur);
          queue.push(l.target);
        }
      }
    }
  }
  const path: string[] = [];
  if (prev.has(box)) for (let c: string | null = prev.get(box)!; c; c = prev.get(c) ?? null) path.unshift(c);
  const take = (id: string, lines: Line[]) => {
    for (const l of lines) {
      if (l.type === 'note') continue;
      if (l.type === 'command' || isStage(l.type)) applyAny(st, l, id, p);
      else {
        if (l.fx?.fx) st.fx = l.fx.fx === 'default' || l.fx.fx === 'none' ? null : l.fx.fx;
        if (l.type === 'say' && l.who && l.attr?.trim() && st.sprites.some((x) => x.tag === l.who)) putImage(st, l.who + ' ' + l.attr.trim(), id, {});
      }
    }
  };
  for (const id of path) take(id, byId.get(id)!.lines);
  take(box, (byId.get(box)?.lines ?? []).slice(0, lineIndex));
  // 앞에서 지나온 전환과 효과음은 다시 돌리지 않는다
  return { ...cloneStage(st), sound: null, soundSeq: 0, sprites: st.sprites.map((s) => ({ ...s, trans: undefined })), bg: st.bg && { ...st.bg, trans: undefined } };
}

export function start(p: Project, from: string | null, lineId?: string | null): PState {
  const box = p.nodes.find((n) => n.id === from);
  const lineIndex = lineId ? Math.max(0, box?.lines.findIndex((l) => l.id === lineId) ?? 0) : 0;
  const s: PState = {
    node: from, line: lineIndex, stack: [], menu: null, show: null, showNode: null, commands: [],
    ended: null, brokenAt: null, visited: from ? [from] : [], edges: [],
    stage: from && from !== p.project.startNode || lineIndex ? seedStage(p, from ?? '', lineIndex) : emptyStage(),
  };
  return advance(p, s);
}

export function choose(p: Project, s: PState, c: Choice): PState {
  const n: PState = { ...s, menu: null };
  if (!c.target) return { ...n, ended: 'broken', brokenAt: s.node };
  move(n, s.node!, c.target);
  return advance(p, n);
}
