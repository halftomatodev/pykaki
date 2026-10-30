import { memo, useLayoutEffect, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStore } from './store';
import * as ops from './ops';
import type { BoxNode, Line } from './types';
import { uid } from './util';
import { changeThenFocus } from './actions';
import { FlowMenu } from './FlowMenu';
import { SpeakerSelect, StageFields, useLineDrag } from './LineFields';
import { isStage, stageCode } from './stage';
import { hit, keyOf } from './prefs';

// 볼 때와 글을 고칠 때 상자 모양이 같다. 고칠 때는 글자 자리가 입력칸으로 바뀌고,
// 줄 종류·순서·삭제 단추는 상자 왼쪽 바깥에, 연출 입력칸은 오른쪽 바깥에 붙는다
export const BoxView = memo(function BoxView({ id, selected }: NodeProps) {
  const project = useStore((s) => s.project);
  const play = useStore((s) => s.play);
  const editing = useStore((s) => s.inlineEdit === id);
  const update = useStore((s) => s.update);
  const b = project.nodes.find((n) => n.id === id);
  if (!b) return null;
  const g = project.labels.find((l) => l.id === b.group);
  const isEntry = g?.entry === b.id;
  const isStart = project.project.startNode === b.id;
  const tb = project.layout.direction === 'TB';
  const cls = ['box', selected && 'sel', editing && 'editing', play?.current === id && 'playing', play?.visitedNodes.includes(id) && 'visited'].filter(Boolean).join(' ');
  const onEsc = (e: React.KeyboardEvent) => e.key === 'Escape' && useStore.setState({ inlineEdit: null });

  return (
    <div className={cls + (b.color ? ' own-color' : '')} style={{ '--g': b.color ?? g?.color ?? 'var(--panel)' } as React.CSSProperties}>
      {editing && <FlowMenu b={b} />}
      <Handle type="target" id="in" position={tb ? Position.Top : Position.Left} />
      <div className="box-head">
        <span className="badge" title="렌파이 label">
          {g?.name ?? '?'}
          {!isEntry && <small>.{b.id}</small>}
        </span>
        {isStart && <span className="badge start">시작</span>}
        {editing ? (
          <input
            id={'in-title-' + b.id}
            className="nodrag box-title ed"
            value={b.title}
            placeholder="(제목 없음)"
            onKeyDown={onEsc}
            onChange={(e) => update((p) => void (ops.findBox(p, b.id)!.title = e.target.value), 'title' + b.id)}
          />
        ) : (
          <span className="box-title" data-part="title">{b.title || '(제목 없음)'}</span>
        )}
      </div>
      <Lines b={b} editing={editing} />
      <div className="box-exit">
        {b.exit.type === 'next' && (
          <>
            <div className="exit-label">→ 다음{!b.exit.target && <span className="todo"> (연결 안 됨)</span>}</div>
            <Handle type="source" id="next" position={tb ? Position.Bottom : Position.Right} />
          </>
        )}
        {b.exit.type === 'menu' &&
          b.exit.choices.map((c, i) => (
            <div className="choice" key={c.id} data-part={c.id}>
              ◆{' '}
              {editing ? (
                <input
                  id={'in-' + c.id}
                  className="nodrag ed"
                  value={c.text}
                  placeholder={`선택지 ${i + 1}`}
                  onKeyDown={onEsc}
                  onChange={(e) => update((p) => void ((ops.findBox(p, b.id)!.exit as any).choices[i].text = e.target.value), 'choice' + c.id)}
                />
              ) : (
                c.text || <i className="todo">(빈 선택지)</i>
              )}
              <Handle type="source" id={'c:' + c.id} position={Position.Right} />
            </div>
          ))}
        {editing && b.exit.type === 'menu' && (
          <button
            className="nodrag faint-add"
            onClick={() => {
              const c = ops.newChoice();
              changeThenFocus(() => update((p) => void (ops.findBox(p, b.id)!.exit as any).choices.push(c)), 'in-' + c.id);
            }}
          >
            + 선택지
          </button>
        )}
        {b.exit.type === 'call' && (
          <>
            <div className="exit-label call">
              ⤷ call{!b.exit.target && <span className="todo"> (대상 없음)</span>} · 복귀 후{!b.exit.then && ' return'}
            </div>
            <Handle type="source" id="call" className="h-call" position={tb ? Position.Bottom : Position.Right} style={tb ? { left: '30%' } : { top: '75%' }} />
            <Handle type="source" id="then" position={tb ? Position.Bottom : Position.Right} style={tb ? { left: '70%' } : { top: '90%' }} />
          </>
        )}
        {b.exit.type === 'return' && <div className="exit-label end">■ 끝 (return)</div>}
      </div>
    </div>
  );
});

const STAGE_ICON: Record<string, string> = { scene: '🖼', show: '🧍', hide: '🙈', music: '🎵', sound: '🔊' };

function Lines({ b, editing }: { b: BoxNode; editing: boolean }) {
  const update = useStore((s) => s.update);
  const upd = (fn: (x: BoxNode) => void, key?: string) => update((p) => fn(ops.findBox(p, b.id)!), key);
  const [active, setActive] = useState<string | null>(null);
  const [top, setTop] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useLineDrag((from, to) => upd((x) => ops.moveLine(x, from, to)));

  const ai = editing ? b.lines.findIndex((l) => l.id === active) : -1;
  const al = ai >= 0 ? b.lines[ai] : null;

  // 단추 묶음이 지금 줄 높이를 따라 내려가게 한다 (상자 안 좌표라 확대해도 그대로)
  useLayoutEffect(() => {
    const row = al && (wrap.current?.querySelector(`[data-line="${al.id}"]`) as HTMLElement | null);
    const t = row ? row.offsetTop : null;
    if (t !== top) setTop(t);
  });

  const addAfter = (i: number, like?: Line) => {
    const nl: Line = { id: uid('l'), type: like && (like.type === 'say' || like.type === 'narration') ? like.type : 'narration', who: like?.who, text: '' };
    changeThenFocus(() => upd((x) => void x.lines.splice(i + 1, 0, nl)), 'in-' + nl.id);
  };

  const remove = (i: number) => {
    const next = b.lines[i + 1] ?? b.lines[i - 1];
    upd((x) => void x.lines.splice(i, 1));
    if (next) changeThenFocus(() => setActive(next.id), 'in-' + next.id);
  };

  const onKey = (e: React.KeyboardEvent, i: number, l: Line) => {
    if (e.key === 'Escape') useStore.setState({ inlineEdit: null });
    else if (hit(e, 'newLine')) {
      e.preventDefault();
      addAfter(i, l);
    }
  };

  const setLine = (i: number) => (fn: (x: Line) => void, key?: string) => upd((x) => fn(x.lines[i]), key);

  return (
    <div className="box-lines" ref={wrap}>
      {b.lines.map((l, i) => (
        <LineRow
          key={l.id}
          l={l}
          editing={editing}
          active={editing && l.id === active}
          cls={editing ? drag.cls(i) : ''}
          rowProps={editing ? drag.row(i) : {}}
          onFocus={() => setActive(l.id)}
          onKey={(e) => onKey(e, i, l)}
          onText={(v) => upd((x) => void (x.lines[i].text = v), 'text' + l.id)}
        />
      ))}
      {!b.lines.length && <div className="more">대사 없음</div>}

      {editing && al && top !== null && (
        <>
          <div className="side side-l nodrag" style={{ top }} key="l">
            <span className="grip" {...drag.grip(ai)}>⠿</span>
            <SpeakerSelect className="nodrag" l={al} set={setLine(ai)} />
            {al.type === 'say' && (
              <input className="nodrag side-attr" placeholder="표정" value={al.attr ?? ''} onChange={(e) => upd((x) => void (x.lines[ai].attr = e.target.value), 'attr' + al.id)} />
            )}
            <button className="nodrag" title="아래에 새 줄" onClick={() => addAfter(ai, al)}>＋</button>
            <button className="nodrag" title="줄 삭제" onClick={() => remove(ai)}>✕</button>
          </div>
          {isStage(al.type) && (
            <div className="side side-r nodrag" style={{ top }}>
              <StageFields l={al} nd="nodrag" set={setLine(ai)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface RowProps {
  l: Line;
  editing: boolean;
  active: boolean;
  cls: string;
  rowProps: object;
  onFocus: () => void;
  onKey: (e: React.KeyboardEvent) => void;
  onText: (v: string) => void;
}

// 줄 하나. 볼 때와 고칠 때 같은 자리에 같은 크기로 그린다
function LineRow({ l, editing, active, cls, rowProps, onFocus, onKey, onText }: RowProps) {
  const ch = useStore((s) => (l.type === 'say' ? s.project.characters.find((c) => c.id === l.who) : undefined));
  const stage = isStage(l.type);
  const kind = stage ? 'pl-stage' : l.type === 'command' ? 'cmd' : l.type === 'note' ? 'note' : l.type === 'narration' ? 'narr' : 'say';
  const empty = { narration: '(빈 내레이션)', say: '(빈 대사)', command: '(빈 명령)', note: '(빈 메모)' }[l.type as 'say'];

  let body;
  if (stage) {
    const { code, problem } = stageCode(l);
    body = (
      <span className="pl-text">
        {STAGE_ICON[l.type]} {code ? <code>{code}</code> : <i className="todo">({problem})</i>}
      </span>
    );
  } else if (editing)
    body = (
      <textarea
        id={'in-' + l.id}
        className="nodrag nowheel pl-text ed"
        rows={1}
        value={l.text}
        placeholder={empty}
        onKeyDown={onKey}
        onChange={(e) => onText(e.target.value)}
      />
    );
  else body = <span className="pl-text">{l.text || <i className="todo">{empty}</i>}</span>;

  return (
    <div
      className={'pl ' + kind + (editing ? ' nodrag' : '') + (active ? ' active' : '') + cls}
      data-part={l.id}
      data-line={l.id}
      {...rowProps}
      onFocus={editing ? onFocus : undefined}
      // 연출 줄은 글을 쓰지 않으니 줄 자체가 포커스를 받는다
      id={editing && stage ? 'in-' + l.id : undefined}
      tabIndex={editing && stage ? 0 : undefined}
      onKeyDown={editing && stage ? onKey : undefined}
    >
      {l.type === 'say' && (
        <span className={'who' + (ch ? '' : ' unknown')} style={{ '--c': ch?.color ?? '#ef4444' } as React.CSSProperties}>
          {ch?.name ?? l.who ?? '?'}
        </span>
      )}
      {l.type === 'say' && l.attr && <span className="attr">({l.attr})</span>}
      {l.type === 'note' && <span className="mark">#</span>}
      {body}
    </div>
  );
}

export function GroupFrame({ data }: NodeProps) {
  const g = useStore((s) => s.project.labels.find((l) => l.id === (data as any).groupId));
  if (!g) return null;
  return (
    <div className="frame" style={{ '--g': g.color } as React.CSSProperties}>
      <span title="클릭: 이 label의 상자 모두 선택">
        {g.title ? `${g.title} · ` : ''}
        <code>{g.name}</code>
      </span>
    </div>
  );
}
