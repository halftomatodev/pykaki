// 상자 안 편집과 오른쪽 편집 탭이 함께 쓰는 줄 입력 부품
import { useState } from 'react';
import { useStore } from './store';
import * as ops from './ops';
import type { ImageKind, Line } from './types';
import { POSITIONS, STAGE_LABEL, STAGE_TYPES, TRANSITIONS, stageCode } from './stage';

type SetLine = (fn: (x: Line) => void, key?: string) => void;

// 줄 종류(화자) 고르기
export function SpeakerSelect({ l, set, className }: { l: Line; set: SetLine; className?: string }) {
  const chars = useStore((s) => s.project.characters);
  const val = ops.speakerValue(l);
  return (
    <select className={className} value={val} onChange={(e) => set((x) => ops.setSpeaker(x, e.target.value))}>
      <optgroup label="대사">
        <option value="narration">내레이션</option>
        {chars.map((c) => (
          <option key={c.id} value={'say:' + c.id}>{c.name}</option>
        ))}
        {l.type === 'say' && !chars.some((c) => c.id === l.who) && <option value={val}>? {l.who}</option>}
      </optgroup>
      <optgroup label="연출">
        {STAGE_TYPES.map((t) => (
          <option key={t} value={t}>{STAGE_LABEL[t]}</option>
        ))}
      </optgroup>
      <optgroup label="기타">
        <option value="command">⚙ 직접 명령</option>
        <option value="note"># 메모</option>
      </optgroup>
    </select>
  );
}

// 연출 줄의 입력칸. 명령을 몰라도 고르고 채우기만 하면 된다
export function StageFields({ l, set, firstId, nd = '' }: { l: Line; set: SetLine; firstId?: string; nd?: string }) {
  const chars = useStore((s) => s.project.characters);
  const kind = l.kind ?? 'char';
  const { code, problem } = stageCode(l);
  const field = (k: 'image' | 'attr' | 'file', placeholder: string, id?: string, cls = '') => (
    <input id={id} className={nd + ' sf-in ' + cls} placeholder={placeholder} value={l[k] ?? ''} onChange={(e) => set((x) => void (x[k] = e.target.value), k + l.id)} />
  );
  const pick = (items: [string, string][], v: string | undefined, fn: (x: Line, v: string) => void, title: string) => (
    <select className={nd} title={title} value={v ?? ''} onChange={(e) => set((x) => fn(x, e.target.value))}>
      {items.map(([k, t]) => (
        <option key={k} value={k}>{t}</option>
      ))}
    </select>
  );
  const kindSel = pick([['char', '캐릭터'], ['bg', '배경'], ['etc', '기타']], kind, (x, v) => void (x.kind = v as ImageKind), '이미지 종류');
  const charSel = (
    <select id={firstId} className={nd + (l.who ? '' : ' invalid')} value={l.who ?? ''} onChange={(e) => set((x) => void (x.who = e.target.value || undefined))}>
      <option value="">캐릭터 선택</option>
      {chars.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
      {l.who && !chars.some((c) => c.id === l.who) && <option value={l.who}>? {l.who}</option>}
    </select>
  );
  const trans = pick(TRANSITIONS, l.trans, (x, v) => void (x.trans = v || undefined), '나타나는 방식');

  let body;
  if (l.type === 'scene') body = <>{field('image', '배경 이름 (예: room) · 비우면 검은 화면', firstId, 'wide')}{trans}</>;
  else if (l.type === 'show')
    body = (
      <>
        {kindSel}
        {kind === 'char' ? <>{charSel}{field('attr', '표정 (예: smile)', undefined, 'short')}</> : field('image', kind === 'bg' ? '배경 이름 (예: room)' : '이미지 이름', firstId)}
        {pick(POSITIONS, l.at, (x, v) => void (x.at = v || undefined), '위치')}
        {trans}
      </>
    );
  else if (l.type === 'hide')
    body = (
      <>
        {kindSel}
        {kind === 'char' ? charSel : kind === 'etc' ? field('image', '이미지 이름', firstId) : <span className="tip">배경을 지워요</span>}
        {trans}
      </>
    );
  else if (l.type === 'music')
    body = (
      <>
        {pick([['', '틀기'], ['stop', '멈추기']], l.stop ? 'stop' : '', (x, v) => void (v ? (x.stop = true) : delete x.stop), '틀기/멈추기')}
        {!l.stop && field('file', '파일 이름 (예: rain.ogg)', firstId, 'wide')}
      </>
    );
  else body = field('file', '파일 이름 (예: door.ogg)', firstId, 'wide');

  return (
    <div className="sf">
      <div className="sf-row">{body}</div>
      <code className={'sf-code' + (code ? '' : ' todo')} title="내보낼 렌파이 명령">{code ?? problem}</code>
    </div>
  );
}

// 줄을 끌어서 순서 바꾸기. 손잡이(⠿)만 끌 수 있고, 줄 위에 놓으면 위/아래 절반에 따라 앞/뒤로 들어간다
export function useLineDrag(move: (from: number, to: number) => void) {
  const [from, setFrom] = useState<number | null>(null);
  const [over, setOver] = useState<{ i: number; after: boolean } | null>(null);
  const reset = () => (setFrom(null), setOver(null));

  const grip = (i: number) => ({
    draggable: true,
    title: '끌어서 순서 바꾸기',
    onDragStart: (e: React.DragEvent<HTMLElement>) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/x-pykaki-line', String(i));
      const row = e.currentTarget.closest('[data-row]');
      if (row) e.dataTransfer.setDragImage(row, 12, 12);
      setFrom(i);
    },
    onDragEnd: reset,
  });

  const row = (i: number) => ({
    'data-row': i,
    onDragOver: (e: React.DragEvent<HTMLElement>) => {
      if (from === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const r = e.currentTarget.getBoundingClientRect();
      const after = e.clientY > r.top + r.height / 2;
      if (over?.i !== i || over.after !== after) setOver({ i, after });
    },
    onDrop: (e: React.DragEvent<HTMLElement>) => {
      if (from === null || !over) return;
      e.preventDefault();
      const to = over.i + (over.after ? 1 : 0);
      if (to !== from && to !== from + 1) move(from, to);
      reset();
    },
  });

  const cls = (i: number) => (from === i ? ' dragging' : '') + (over?.i === i && from !== null ? (over.after ? ' drop-after' : ' drop-before') : '');
  return { grip, row, cls };
}

