import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStore } from './store';
import * as ops from './ops';
import type { BoxNode, Line } from './types';
import { hexAlpha, uid } from './util';
import { changeThenFocus } from './actions';
import { SpeakerSelect, StageFields, useLineDrag } from './LineFields';
import { isStage, stageCode } from './stage';

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
  const MAX = 8;
  const close = () => useStore.setState({ inlineEdit: null });
  const onEsc = (e: React.KeyboardEvent) => e.key === 'Escape' && close();

  return (
    <div className={cls} style={{ background: g?.color ?? '#fff' }}>
      <Handle type="target" id="in" position={tb ? Position.Top : Position.Left} />
      <div className="box-head">
        <span className="badge" title="렌파이 label">
          {g?.name ?? '?'}
          {!isEntry && <small>.{b.id}</small>}
        </span>
        {isStart && <span className="badge start">시작</span>}
        {editing ? (
          <>
            <input
              id={'in-title-' + b.id}
              className="nodrag il-title"
              value={b.title}
              placeholder="상자 제목"
              onKeyDown={onEsc}
              onChange={(e) => update((p) => void (ops.findBox(p, b.id)!.title = e.target.value), 'title' + b.id)}
            />
            <button className="nodrag il-done" onClick={close} title="편집 끝내기 (Esc)">완료</button>
          </>
        ) : (
          <span className="box-title" data-part="title">{b.title || '(제목 없음)'}</span>
        )}
      </div>
      {editing ? (
        <InlineLines b={b} />
      ) : (
        <div className="box-lines">
          {b.lines.slice(0, MAX).map((l) => (
            <LinePreview key={l.id} l={l} />
          ))}
          {b.lines.length > MAX && <div className="more">… {b.lines.length - MAX}줄 더</div>}
          {!b.lines.length && <div className="more">대사 없음</div>}
        </div>
      )}
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
              {editing ? (
                <input
                  id={'in-' + c.id}
                  className="nodrag il-choice"
                  value={c.text}
                  placeholder={`선택지 ${i + 1}`}
                  onKeyDown={onEsc}
                  onChange={(e) => update((p) => void ((ops.findBox(p, b.id)!.exit as any).choices[i].text = e.target.value), 'choice' + c.id)}
                />
              ) : (
                <>◆ {c.text || <i className="todo">(빈 선택지)</i>}</>
              )}
              <Handle type="source" id={'c:' + c.id} position={Position.Right} />
            </div>
          ))}
        {editing && b.exit.type === 'menu' && (
          <button className="nodrag il-add" onClick={() => {
            const c = ops.newChoice();
            changeThenFocus(() => update((p) => void (ops.findBox(p, b.id)!.exit as any).choices.push(c)), 'in-' + c.id);
          }}>+ 선택지</button>
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

// 상자 안에서 바로 쓰는 대사 목록
function InlineLines({ b }: { b: BoxNode }) {
  const update = useStore((s) => s.update);
  const upd = (fn: (x: BoxNode) => void, key?: string) => update((p) => fn(ops.findBox(p, b.id)!), key);

  const addAfter = (i: number, like?: Line) => {
    const nl: Line = { id: uid('l'), type: like && (like.type === 'say' || like.type === 'narration') ? like.type : 'narration', who: like?.who, text: '' };
    changeThenFocus(() => upd((x) => void x.lines.splice(i + 1, 0, nl)), 'in-' + nl.id);
  };

  const onKey = (e: React.KeyboardEvent, i: number, l: Line) => {
    if (e.key === 'Escape') useStore.setState({ inlineEdit: null });
    else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      addAfter(i, l);
    }
  };

  const drag = useLineDrag((from, to) => upd((x) => ops.moveLine(x, from, to)));

  return (
    <div className="box-lines il-lines">
      {b.lines.map((l, i) => (
        <div className={'il t-' + l.type + (isStage(l.type) ? ' t-stage' : '') + drag.cls(i)} key={l.id} {...drag.row(i)}>
          <div className="il-top">
            <span className="nodrag grip" {...drag.grip(i)}>⠿</span>
            <SpeakerSelect className="nodrag" l={l} set={(fn) => upd((x) => fn(x.lines[i]))} />
            {l.type === 'say' && (
              <input className="nodrag il-attr" placeholder="속성" value={l.attr ?? ''} onChange={(e) => upd((x) => void (x.lines[i].attr = e.target.value), 'attr' + l.id)} />
            )}
            <span className="sp" />
            <button className="nodrag" title="줄 삭제" onClick={() => upd((x) => void x.lines.splice(i, 1))}>✕</button>
          </div>
          {isStage(l.type) ? (
            <StageFields l={l} nd="nodrag" firstId={'in-' + l.id} set={(fn, key) => upd((x) => fn(x.lines[i]), key)} />
          ) : (
            <textarea
              id={'in-' + l.id}
              className="nodrag nowheel"
              rows={1}
              value={l.text}
              placeholder={l.type === 'command' ? 'show / scene / play …' : l.type === 'note' ? '메모' : '대사'}
              onKeyDown={(e) => onKey(e, i, l)}
              onChange={(e) => upd((x) => void (x.lines[i].text = e.target.value), 'text' + l.id)}
            />
          )}
        </div>
      ))}
      <div className="il-foot">
        <button className="nodrag il-add" onClick={() => addAfter(b.lines.length - 1, b.lines[b.lines.length - 1])}>+ 줄</button>
        <span className="tip">Ctrl+Enter 새 줄 · ⠿ 끌어서 순서 · Esc 완료</span>
      </div>
    </div>
  );
}

const STAGE_ICON: Record<string, string> = { scene: '🖼', show: '🧍', hide: '🙈', music: '🎵', sound: '🔊' };

function LinePreview({ l }: { l: Line }) {
  const ch = useStore((s) => (l.type === 'say' ? s.project.characters.find((c) => c.id === l.who) : undefined));
  if (isStage(l.type)) {
    const { code, problem } = stageCode(l);
    return (
      <div className="pl cmd pl-stage" data-part={l.id}>
        {STAGE_ICON[l.type]} {code ? <code>{code}</code> : <i className="todo">({problem})</i>}
      </div>
    );
  }
  if (l.type === 'command')
    return (
      <div className="pl cmd" data-part={l.id}>
        <code>{l.text}</code>
      </div>
    );
  if (l.type === 'note') return <div className="pl note" data-part={l.id}># {l.text}</div>;
  if (l.type === 'narration') return <div className="pl narr" data-part={l.id}>{l.text || <i className="todo">(빈 내레이션)</i>}</div>;
  return (
    <div className="pl" data-part={l.id}>
      <span className="who" style={{ background: ch ? hexAlpha(ch.color, 0.55) : '#fecaca' }}>{ch?.name ?? l.who ?? '?'}</span>
      {l.attr && <span className="attr">({l.attr})</span>}
      {l.text || <i className="todo">(빈 대사)</i>}
    </div>
  );
}

export function GroupFrame({ data }: NodeProps) {
  const g = useStore((s) => s.project.labels.find((l) => l.id === (data as any).groupId));
  if (!g) return null;
  return (
    <div className="frame" style={{ borderColor: g.color, background: hexAlpha(g.color, 0.28) }}>
      <span title="클릭: 이 label의 상자 모두 선택">
        {g.title ? `${g.title} · ` : ''}
        <code>{g.name}</code>
      </span>
    </div>
  );
}
