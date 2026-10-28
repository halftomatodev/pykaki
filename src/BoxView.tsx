import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStore } from './store';
import type { Line } from './types';
import { hexAlpha } from './util';

export const BoxView = memo(function BoxView({ id, selected }: NodeProps) {
  const project = useStore((s) => s.project);
  const play = useStore((s) => s.play);
  const b = project.nodes.find((n) => n.id === id);
  if (!b) return null;
  const g = project.labels.find((l) => l.id === b.group);
  const isEntry = g?.entry === b.id;
  const isStart = project.project.startNode === b.id;
  const tb = project.layout.direction === 'TB';
  const cls = ['box', selected && 'sel', play?.current === id && 'playing', play?.visitedNodes.includes(id) && 'visited'].filter(Boolean).join(' ');
  const MAX = 8;

  return (
    <div className={cls} style={{ background: g?.color ?? '#fff' }}>
      <Handle type="target" id="in" position={tb ? Position.Top : Position.Left} />
      <div className="box-head">
        <span className="badge" title="렌파이 label">
          {g?.name ?? '?'}
          {!isEntry && <small>.{b.id}</small>}
        </span>
        {isStart && <span className="badge start">시작</span>}
        <span className="box-title" data-part="title">{b.title || '(제목 없음)'}</span>
      </div>
      <div className="box-lines">
        {b.lines.slice(0, MAX).map((l) => (
          <LinePreview key={l.id} l={l} />
        ))}
        {b.lines.length > MAX && <div className="more">… {b.lines.length - MAX}줄 더</div>}
        {!b.lines.length && <div className="more">대사 없음</div>}
      </div>
      <div className="box-exit">
        {b.exit.type === 'next' && (
          <>
            <div className="exit-label">→ 다음{!b.exit.target && <span className="todo"> (연결 안 됨)</span>}</div>
            <Handle type="source" id="next" position={tb ? Position.Bottom : Position.Right} />
          </>
        )}
        {b.exit.type === 'menu' &&
          b.exit.choices.map((c) => (
            <div className="choice" key={c.id} data-part={c.id}>
              ◆ {c.text || <i className="todo">(빈 선택지)</i>}
              <Handle type="source" id={'c:' + c.id} position={Position.Right} />
            </div>
          ))}
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

function LinePreview({ l }: { l: Line }) {
  const ch = useStore((s) => (l.type === 'say' ? s.project.characters.find((c) => c.id === l.who) : undefined));
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
