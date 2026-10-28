// 프로젝트 → .rpy 변환과 검사. 설계 문서 6장 참고.
import type { BoxNode, LabelGroup, Line, Project, Settings } from './types';
import { exitLinks, fallTarget } from './ops';
import { IDENT, RESERVED } from './util';

export interface Warn { level: 'error' | 'warn'; msg: string; nodeId?: string }

export function escapeText(t: string, s: Settings) {
  let r = t.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  if (s.escapeBrackets) r = r.replace(/\[/g, '[[');
  if (!s.allowTextTags) r = r.replace(/\{/g, '{{');
  if (s.escapePercent) r = r.replace(/%/g, '%%');
  return r.replace(/\r?\n/g, '\\n');
}

const pyStr = (s: string) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

// label 안의 상자 순서: 첫 상자부터, "다음으로" 이어지는 상자는 바로 뒤에 붙인다
function orderGroup(p: Project, g: LabelGroup, byId: Map<string, BoxNode>): BoxNode[] {
  const members = p.nodes.filter((n) => n.group === g.id);
  if (!members.length) return [];
  const inG = new Set(members.map((n) => n.id));
  const entry = g.entry && inG.has(g.entry) ? g.entry : members[0].id;

  const visit: string[] = [];
  const seen = new Set([entry]);
  const q = [entry];
  while (q.length) {
    const id = q.shift()!;
    visit.push(id);
    for (const l of exitLinks(byId.get(id)!))
      if (l.target && inG.has(l.target) && !seen.has(l.target)) {
        seen.add(l.target);
        q.push(l.target);
      }
  }
  for (const m of members) if (!seen.has(m.id)) visit.push(m.id);

  const placed = new Set<string>();
  const out: BoxNode[] = [];
  for (const start of visit) {
    let cur: string | null = start;
    while (cur && inG.has(cur) && !placed.has(cur)) {
      placed.add(cur);
      const b = byId.get(cur)!;
      out.push(b);
      cur = fallTarget(b);
    }
  }
  return out;
}

export function generateRpy(p: Project): { code: string; warnings: Warn[] } {
  const W: Warn[] = [];
  const out: string[] = [];
  const byId = new Map(p.nodes.map((n) => [n.id, n]));
  const groupById = new Map(p.labels.map((g) => [g.id, g]));
  const charById = new Map(p.characters.map((c) => [c.id, c]));
  const S = p.settings;

  // 이름 검사
  const names = new Set<string>();
  for (const g of p.labels) {
    const at = g.entry ?? undefined;
    if (!IDENT.test(g.name) || RESERVED.has(g.name))
      W.push({ level: 'error', msg: `label 이름 "${g.name}"은 쓸 수 없어요 (영문·숫자·_만, 숫자로 시작 불가, 예약어 불가)`, nodeId: at });
    if (names.has(g.name)) W.push({ level: 'error', msg: `label 이름 "${g.name}"이 중복돼요`, nodeId: at });
    names.add(g.name);
  }
  const cids = new Set<string>();
  for (const c of p.characters) {
    if (!IDENT.test(c.id) || RESERVED.has(c.id)) W.push({ level: 'error', msg: `캐릭터 id "${c.id}"는 쓸 수 없어요` });
    if (cids.has(c.id)) W.push({ level: 'error', msg: `캐릭터 id "${c.id}"가 중복돼요` });
    cids.add(c.id);
  }

  const orders = new Map<string, BoxNode[]>();
  const entryOf = new Map<string, string>();
  for (const g of p.labels) {
    const o = orderGroup(p, g, byId);
    orders.set(g.id, o);
    if (o.length) entryOf.set(g.id, o[0].id);
  }
  const ref = (id: string) => {
    const g = groupById.get(byId.get(id)!.group)!;
    return entryOf.get(g.id) === id ? g.name : `${g.name}.${id}`;
  };

  const incoming = new Map<string, { from: string }[]>();
  const addIn = (to: string, from: string) => incoming.set(to, [...(incoming.get(to) ?? []), { from }]);
  for (const b of p.nodes) for (const l of exitLinks(b)) if (l.target && byId.has(l.target)) addIn(l.target, b.id);

  // 머리말과 캐릭터
  out.push(`# ${p.project.title}`);
  out.push("# PyKaki가 만든 파일이에요. 직접 고치면 다음 내보내기 때 덮어써져요.");
  out.push('');
  for (const c of p.characters) out.push(`define ${c.id} = Character(${pyStr(c.name)}${c.color ? `, color=${pyStr(c.color)}` : ''})`);
  if (p.characters.length) out.push('');

  // 시작
  const start = p.project.startNode ? byId.get(p.project.startNode) : undefined;
  if (!start) W.push({ level: 'error', msg: '시작 상자가 없어요. 상자를 고르고 "시작 상자로"를 눌러 주세요.' });
  else {
    addIn(start.id, '__start');
    const sg = groupById.get(start.group)!;
    const startLabel = p.labels.find((l) => l.name === 'start');
    if (startLabel) {
      if (!(sg.id === startLabel.id && entryOf.get(sg.id) === start.id))
        W.push({ level: 'error', msg: '"start"라는 label이 있으면 시작 상자가 그 label의 첫 상자여야 해요', nodeId: start.id });
    } else out.push('label start:', `    jump ${ref(start.id)}`, '');
  }

  const I = '    ';
  const q = (t: string) => '"' + escapeText(t, S) + '"';

  for (const g of p.labels) {
    const o = orders.get(g.id)!;
    if (!o.length) continue;
    out.push(`# ── ${oneLine(g.title || g.name)} ──`);
    o.forEach((b, i) => {
      const prev = o[i - 1];
      const nextId = o[i + 1]?.id ?? null;
      const inc = incoming.get(b.id) ?? [];
      const onlyFall = prev && inc.length === 1 && inc[0].from === prev.id && fallTarget(prev) === b.id;
      out.push(`# @node:${b.id}${b.title ? ' ' + oneLine(b.title) : ''}`);
      if (i === 0) out.push(`label ${g.name}:`);
      else if (!onlyFall) out.push(`label ${g.name}.${b.id}:`);

      const body: string[] = [];
      const lineOut = (l: Line) => {
        if (l.type === 'note') return l.text.split('\n').forEach((x) => body.push('# ' + x));
        if (l.type === 'command') return l.text.split('\n').forEach((x) => x.trim() && body.push(x.trimEnd()));
        if (!l.text.trim()) W.push({ level: 'warn', msg: `빈 대사가 있어요 (${b.title || b.id})`, nodeId: b.id });
        if (l.type === 'narration') return body.push(q(l.text));
        const c = l.who ? charById.get(l.who) : undefined;
        if (!c) {
          W.push({ level: 'error', msg: `등록되지 않은 화자 "${l.who ?? ''}" (${b.title || b.id})`, nodeId: b.id });
          body.push(`# 화자 없음: ${l.who ?? ''}`, q(l.text));
        } else body.push(`${c.id}${l.attr?.trim() ? ' ' + l.attr.trim() : ''} ${q(l.text)}`);
      };
      b.lines.forEach(lineOut);

      const todo = 'return  # TODO: 연결 안 됨';
      const flow = (t: string | null) => (!t ? [todo] : t === nextId ? [] : [`jump ${ref(t)}`]);
      const e = b.exit;
      if (e.type === 'next') {
        if (!e.target) W.push({ level: 'warn', msg: `다음 흐름이 연결되지 않았어요 (${b.title || b.id})`, nodeId: b.id });
        body.push(...flow(e.target));
      } else if (e.type === 'menu') {
        if (!e.choices.length) {
          W.push({ level: 'error', msg: `선택지가 비어 있어요 (${b.title || b.id})`, nodeId: b.id });
          body.push('return');
        } else {
          body.push('menu:');
          for (const c of e.choices) {
            if (!c.text.trim()) W.push({ level: 'warn', msg: `선택지 문구가 비어 있어요 (${b.title || b.id})`, nodeId: b.id });
            body.push(`${I}${q(c.text)}:`);
            if (!c.target) W.push({ level: 'warn', msg: `선택지 "${c.text}"가 연결되지 않았어요`, nodeId: b.id });
            body.push(I + I + (c.target ? `jump ${ref(c.target)}` : todo));
          }
        }
      } else if (e.type === 'call') {
        if (!e.target) {
          W.push({ level: 'error', msg: `call 대상이 없어요 (${b.title || b.id})`, nodeId: b.id });
          body.push('return  # TODO: call 대상 없음');
        } else {
          body.push(`call ${ref(e.target)}`);
          body.push(...(e.then ? flow(e.then) : ['return']));
        }
      } else body.push('return');

      if (!body.length) body.push('pass');
      for (const x of body) out.push(I + x);
    });
    out.push('');
  }

  // 도달 검사
  const links = (id: string) => exitLinks(byId.get(id)!).map((l) => l.target).filter((t): t is string => !!t && byId.has(t));
  const reach = (from: string) => {
    const seen = new Set([from]);
    const q2 = [from];
    while (q2.length) for (const t of links(q2.shift()!)) if (!seen.has(t)) (seen.add(t), q2.push(t));
    return seen;
  };
  if (start) {
    const r = reach(start.id);
    for (const b of p.nodes) if (!r.has(b.id)) W.push({ level: 'warn', msg: `시작에서 도달할 수 없는 상자예요 (${b.title || b.id})`, nodeId: b.id });
  }
  for (const b of p.nodes)
    if (b.exit.type === 'call' && b.exit.target && byId.has(b.exit.target)) {
      const r = reach(b.exit.target);
      if (![...r].some((id) => byId.get(id)!.exit.type === 'return'))
        W.push({ level: 'warn', msg: `call 대상에서 return(끝)에 도달하지 않아요 (${b.title || b.id})`, nodeId: b.exit.target });
    }

  return { code: out.join('\n') + '\n', warnings: W };
}
