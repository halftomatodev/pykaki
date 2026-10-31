// showpy가 남긴 그림/영상/소리 줄을 대본에 받아 적는다. 문서: docs/LINK.md
// .rpy를 되읽지 않는다. showpy_inbox.json에 적힌 줄만 받는다. 대사 글자와 선택지는 받지 않고, 대사는 위치만 받는다.
import type { BoxNode, Line, LineFx, Project, SayStyle } from './types';

const POS_KEYS = ['x', 'y', 'name_x', 'name_y'] as const;

export interface InboxOp {
  id: string; // 새 줄 id (insert), 또는 이 기록 자체의 id
  op: 'insert' | 'replace' | 'say_pos' | 'say_fx';
  code?: string; // 렌파이 명령 한 줄 (insert, replace)
  pos?: Partial<Record<(typeof POS_KEYS)[number], number | null>>; // say_pos: 대사 위치. null이면 지움
  box?: string; // 그 줄이 있던 상자. 기준 줄이 사라졌을 때 쓴다
  before?: string; // 이 줄 앞에
  after?: string; // 이 줄 뒤에
  end?: string; // 이 상자의 끝에 (선택지, jump 바로 앞)
  sayFx?: Partial<Record<keyof LineFx, string | string[] | null>>; // say_fx: 대사의 화면 효과. null이면 지움
  line?: string; // replace, say_pos, say_fx: 바꿀 줄
}

function applySayPos(l: Line, pos: NonNullable<InboxOp['pos']>) {
  const say: SayStyle = { ...l.say };
  for (const k of POS_KEYS) {
    const v = pos[k];
    if (typeof v === 'number') say[k] = v;
    else if (v === null) delete say[k];
  }
  if (Object.keys(say).length) l.say = say;
  else delete l.say;
}

const withPart = /\s+with\s+(.+)$/;

// 명령 한 줄 → 칸이 있는 줄. 칸으로 못 나타내는 명령은 "직접 명령" 줄이 된다
export function codeToLine(code: string, id: string, p: Project): Line {
  const raw = code.trim();
  const command: Line = { id, type: 'command', text: raw };
  const isChar = (w: string) => p.characters.some((c) => c.id === w);

  let m = /^play\s+(music|sound)\s+"([^"]+)"$/.exec(raw);
  if (m) return { id, type: m[1] as 'music' | 'sound', text: '', file: m[2].replace(/^audio\//, '') };
  if (/^stop\s+music\b/.test(raw)) return { id, type: 'music', text: '', stop: true };

  m = /^(scene|show|hide)(?:\s+(.*))?$/.exec(raw);
  if (!m) return command;
  const type = m[1] as 'scene' | 'show' | 'hide';
  let rest = (m[2] ?? '').trim();
  let trans: string | undefined;
  const w = withPart.exec(rest);
  if (w) {
    trans = w[1].trim();
    rest = rest.slice(0, w.index).trim();
  }
  let at: string | undefined;
  const a = /\s+at\s+(.+)$/.exec(rest);
  if (a) {
    at = a[1].trim();
    rest = rest.slice(0, a.index).trim();
  }
  // 칸이 없는 절(as, behind, onlayer, expression…)이나 왼쪽/오른쪽이 아닌 위치는 그대로 명령으로 둔다
  if (at && at !== 'left' && at !== 'right') return command;
  if (/[^\w\s-]|\b(as|behind|onlayer|zorder|expression)\b/.test(rest)) return command;
  const words = rest.split(/\s+/).filter(Boolean);
  const base: Line = { id, type, text: '' };
  if (trans) base.trans = trans;

  if (type === 'scene') {
    if (!words.length) return base;
    if (words[0] !== 'bg' || words.length < 2) return command;
    return { ...base, image: words.slice(1).join(' ') };
  }
  if (!words.length) return command;
  if (at) base.at = at;
  if (words[0] === 'bg') return type === 'hide' ? { ...base, kind: 'bg' } : { ...base, kind: 'bg', image: words.slice(1).join(' ') };
  if (isChar(words[0])) {
    const r: Line = { ...base, kind: 'char', who: words[0] };
    if (type === 'show' && words.length > 1) r.attr = words.slice(1).join(' ');
    return r;
  }
  return { ...base, kind: 'etc', image: words.join(' ') };
}

function findLine(p: Project, id: string): { box: BoxNode; i: number } | null {
  for (const box of p.nodes) {
    const i = box.lines.findIndex((l) => l.id === id);
    if (i >= 0) return { box, i };
  }
  return null;
}

function applySayFx(l: Line, vals: NonNullable<InboxOp['sayFx']>) {
  const fx = { ...l.fx } as Record<string, unknown>;
  for (const [k, v] of Object.entries(vals)) {
    if (v === null) delete fx[k];
    else fx[k] = v;
  }
  if (Object.keys(fx).length) l.fx = fx as LineFx;
  else delete l.fx;
}

// 기록을 순서대로 대본에 넣는다. p를 직접 고친다
export function applyInbox(p: Project, ops: InboxOp[]): { applied: number; moved: string[]; dropped: string[] } {
  let applied = 0;
  const moved: string[] = [];
  const dropped: string[] = [];
  for (const op of ops) {
    if (op.op === 'say_pos' || op.op === 'say_fx') {
      const at = op.line ? findLine(p, op.line) : null;
      const l = at?.box.lines[at.i];
      if (!l || (l.type !== 'say' && l.type !== 'narration')) {
        dropped.push(op.op === 'say_pos' ? '대사 위치' : '대사 화면 효과');
        continue;
      }
      if (op.pos) applySayPos(l, op.pos);
      if (op.sayFx) applySayFx(l, op.sayFx);
      applied++;
      continue;
    }
    const code = op.code ?? '';
    if (op.op === 'replace') {
      const at = op.line ? findLine(p, op.line) : null;
      if (!at) {
        dropped.push(code);
        continue;
      }
      at.box.lines[at.i] = codeToLine(code, at.box.lines[at.i].id, p);
      applied++;
      continue;
    }
    if (op.op !== 'insert' || findLine(p, op.id)) continue; // 이미 받아 적은 기록은 건너뛴다
    const line = codeToLine(code, op.id, p);
    const anchor = op.before ?? op.after;
    const at = anchor ? findLine(p, anchor) : null;
    if (at) at.box.lines.splice(at.i + (op.before ? 0 : 1), 0, line);
    else {
      const box = p.nodes.find((n) => n.id === (op.end ?? op.box));
      if (!box) {
        dropped.push(code);
        continue;
      }
      if (anchor) moved.push(code); // 기준 줄을 PyKaki에서 지운 경우: 상자 끝으로
      box.lines.push(line);
    }
    applied++;
  }
  return { applied, moved, dropped };
}
