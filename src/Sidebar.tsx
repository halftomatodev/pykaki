import { useEffect, useState } from 'react';
import { connectFolder, disconnectFolder, hasDirPicker, pullInbox, scanFolder, useGameFolder } from './gameFolder';
import { useStore } from './store';
import * as ops from './ops';
import type { Character, LabelGroup } from './types';
import { IDENT, RESERVED } from './util';

export function Sidebar() {
  const project = useStore((s) => s.project);
  const update = useStore((s) => s.update);
  const [showSettings, setShowSettings] = useState(false);

  const addChar = () =>
    update((p) => {
      let i = p.characters.length + 1;
      while (p.characters.some((c) => c.id === 'c' + i)) i++;
      p.characters.push({ id: 'c' + i, name: '새 캐릭터', color: '#c8c8ff' });
    });

  return (
    <aside className="sidebar">
      <input
        className="ptitle"
        value={project.project.title}
        onChange={(e) => update((p) => void (p.project.title = e.target.value), 'ptitle')}
        placeholder="프로젝트 제목"
      />

      <h3>
        캐릭터 <button onClick={addChar}>+ 추가</button>
      </h3>
      {project.characters.length === 0 && <p className="tip">대사를 말할 캐릭터를 추가하세요. 내레이션은 따로 등록하지 않아도 돼요.</p>}
      {project.characters.map((c, i) => (
        <CharRow key={i} c={c} i={i} />
      ))}

      <h3>
        label (장면) <button onClick={() => update((p) => void ops.addGroup(p))}>+ 추가</button>
      </h3>
      {project.labels.map((g) => (
        <GroupRow key={g.id} g={g} />
      ))}

      <h3>
        설정 <button onClick={() => setShowSettings((v) => !v)}>{showSettings ? '접기' : '펼치기'}</button>
      </h3>
      {showSettings && (
        <div className="settings">
          <label>
            <input type="checkbox" checked={project.settings.escapeBrackets} onChange={(e) => update((p) => void (p.settings.escapeBrackets = e.target.checked))} />
            [ 를 글자 그대로 ([[ 로 변환)
          </label>
          <label>
            <input type="checkbox" checked={project.settings.allowTextTags} onChange={(e) => update((p) => void (p.settings.allowTextTags = e.target.checked))} />
            텍스트 태그 사용 ({'{b}'} 등)
          </label>
          <label>
            <input type="checkbox" checked={project.settings.escapePercent} onChange={(e) => update((p) => void (p.settings.escapePercent = e.target.checked))} />
            % 를 글자 그대로 (%% 로 변환)
          </label>
          <label>
            <input type="checkbox" checked={!!project.settings.renpyLink} onChange={(e) => update((p) => void (p.settings.renpyLink = e.target.checked))} />
            showpy 플러그인 연결
          </label>
          {project.settings.renpyLink && <LinkPanel />}
        </div>
      )}
    </aside>
  );
}

// showpy 연결: 렌파이 game 폴더를 잇는 칸
function LinkPanel() {
  const f = useGameFolder();
  if (!hasDirPicker) return <p className="tip">폴더 연결은 크롬과 엣지에서 돼요. 이 브라우저에서는 내려받은 script_flow.rpy를 game 폴더에 넣어 주세요. showpy에서 넣은 줄은 받아 적지 못해요.</p>;
  return (
    <div className="link-panel">
      <p className="tip">{f.name ? `연결한 폴더: ${f.name}` : 'Ctrl+E로 쓸 렌파이 game 폴더를 연결해 주세요.'}</p>
      <div className="row">
        <button onClick={() => void connectFolder()}>{f.name ? '폴더 바꾸기' : '폴더 연결'}</button>
        {f.name && <button onClick={() => void pullInbox(true).then(() => scanFolder())}>다시 읽기</button>}
        {f.name && <button onClick={() => void disconnectFolder()}>끊기</button>}
      </div>
      {f.name && <p className="tip">그림과 영상 {f.media.images.length}개, 소리 {f.media.audio.length}개를 찾았어요.</p>}
      {f.startClash && <p className="tip warn-text">{f.startClash}에도 label start가 있어요. 렌파이가 오류를 내니 그 파일의 label start를 지워 주세요.</p>}
    </div>
  );
}

function CharRow({ c, i }: { c: Character; i: number }) {
  const update = useStore((s) => s.update);
  const chars = useStore((s) => s.project.characters);
  const [id, setId] = useState(c.id);
  useEffect(() => setId(c.id), [c.id]);
  const bad = !IDENT.test(id) || RESERVED.has(id) || chars.some((o, j) => j !== i && o.id === id);

  // id는 입력을 마쳤을 때 확정하고, 그 캐릭터의 대사도 같이 바꾼다
  const commit = () => {
    if (id === c.id) return;
    if (bad) {
      alert(`"${id}"는 캐릭터 id로 쓸 수 없어요 (영문·숫자·_ , 중복 불가)`);
      return setId(c.id);
    }
    update((p) => {
      p.characters[i].id = id;
      for (const n of p.nodes) for (const l of n.lines) if (l.type === 'say' && l.who === c.id) l.who = id;
    });
  };

  const remove = () => {
    const used = useStore.getState().project.nodes.some((n) => n.lines.some((l) => l.who === c.id));
    if (used && !confirm(`${c.name}의 대사가 남아 있어요. 그래도 지울까요? (대사는 "등록되지 않은 화자"로 남아요)`)) return;
    update((p) => void p.characters.splice(i, 1));
  };

  return (
    <div className="item">
      <input type="color" value={c.color} onChange={(e) => update((p) => void (p.characters[i].color = e.target.value), 'ccolor' + i)} />
      <input
        className={'cid' + (bad ? ' invalid' : '')}
        value={id}
        onChange={(e) => setId(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        title="렌파이 변수 이름 (예: a, alice)"
      />
      <input value={c.name} onChange={(e) => update((p) => void (p.characters[i].name = e.target.value), 'cname' + i)} placeholder="표시 이름" />
      <button className="x" onClick={remove} title="삭제">✕</button>
    </div>
  );
}

function GroupRow({ g }: { g: LabelGroup }) {
  const update = useStore((s) => s.update);
  const project = useStore((s) => s.project);
  const ids = project.nodes.filter((n) => n.group === g.id).map((n) => n.id);
  const bad = !IDENT.test(g.name) || RESERVED.has(g.name) || project.labels.some((o) => o.id !== g.id && o.name === g.name);
  const set = (fn: (x: LabelGroup) => void, key?: string) =>
    update((p) => fn(p.labels.find((l) => l.id === g.id)!), key);

  const focus = () => {
    if (!ids.length) return;
    useStore.getState().select(ids);
    useStore.getState().focusNodes(ids);
  };

  return (
    <div className="grp" style={{ borderLeftColor: g.color }}>
      <div className="item">
        <input type="color" value={g.color} onChange={(e) => set((x) => void (x.color = e.target.value), 'gcolor' + g.id)} />
        <input className={'gname' + (bad ? ' invalid' : '')} value={g.name} onChange={(e) => set((x) => void (x.name = e.target.value.replace(/\s/g, '_')), 'gname' + g.id)} title="렌파이 label 이름 (영문·숫자·_)" />
        <button onClick={focus} disabled={!ids.length} title="이 label의 상자들로 이동하고 선택">{ids.length}</button>
        <button className="x" disabled={!!ids.length} onClick={() => update((p) => void (p.labels = p.labels.filter((l) => l.id !== g.id)))} title={ids.length ? '상자가 남아 있으면 지울 수 없어요' : '삭제'}>✕</button>
      </div>
      <input className="gtitle" value={g.title} onChange={(e) => set((x) => void (x.title = e.target.value), 'gtitle' + g.id)} placeholder="표시 제목 (한글 가능)" />
    </div>
  );
}
