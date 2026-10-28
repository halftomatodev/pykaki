import { useEffect, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useStore } from './store';
import { exportRpyFile, hasRpyTarget, newProject, openProject, saveProject } from './files';
import { snapAdd, snapDelete, snapList, type Snapshot } from './persist';
import { addBoxCenter, runLayout } from './actions';
import { timeStr } from './util';

export function Toolbar() {
  const rf = useReactFlow();
  const s = useStore();
  const [showVersions, setShowVersions] = useState(false);
  const sel = s.selectedIds.length;

  const saveVersion = async () => {
    const memo = prompt('버전 메모 (예: 1장 완성, 엔딩 분기 추가 전)');
    if (memo === null) return;
    try {
      await snapAdd(memo || '(메모 없음)', s.project);
      s.say('버전을 저장했어요');
    } catch (e: any) {
      alert('버전 저장 실패: ' + e.message);
    }
  };

  return (
    <div className="toolbar">
      <span className="brand">Ren'Py Flow</span>
      <button onClick={newProject}>새로</button>
      <button onClick={openProject}>열기</button>
      <button onClick={() => saveProject()} title="Ctrl+S">저장</button>
      <button onClick={() => saveProject(true)} title="Ctrl+Shift+S">다른 이름</button>
      <span className="sep" />
      <button onClick={saveVersion}>버전 저장</button>
      <button onClick={() => setShowVersions(true)}>버전 목록</button>
      <span className="sep" />
      <button onClick={() => addBoxCenter(rf)} title="캔버스 빈 곳 더블클릭으로도 만들 수 있어요">+ 상자</button>
      <button onClick={() => runLayout(rf, 'all')}>전체 정렬</button>
      <button disabled={!sel} onClick={() => runLayout(rf, 'label')} title="선택한 상자의 label 안에서만 정렬">label 정렬</button>
      <button disabled={sel < 2} onClick={() => runLayout(rf, 'selection')} title="Shift+드래그로 여러 상자 선택">선택 정렬</button>
      <select
        value={s.project.layout.direction}
        onChange={(e) => s.update((p) => void (p.layout.direction = e.target.value as 'TB' | 'LR'))}
        title="정렬 방향"
      >
        <option value="TB">↓ 위→아래</option>
        <option value="LR">→ 왼→오른</option>
      </select>
      <span className="sep" />
      <button disabled={!s.past.length} onClick={s.undo} title="실행 취소 (Ctrl+Z)">↶</button>
      <button disabled={!s.future.length} onClick={s.redo} title="다시 실행 (Ctrl+Y)">↷</button>
      <span className="sep" />
      <button className="primary" onClick={() => s.startPlay(null)}>▶ 플레이</button>
      <button onClick={() => exportRpyFile(false)}>.rpy 내보내기</button>
      {hasRpyTarget() && <button onClick={() => exportRpyFile(true)} title="Ctrl+E">같은 곳에 다시</button>}
      <span className="grow" />
      {s.flash && <span className="flash">{s.flash}</span>}
      <span className="status">
        {s.fileName ?? '파일로 저장 안 됨'}
        {s.dirty && <b className="dirty" title="파일로 저장하지 않은 변경이 있어요"> ●</b>}
        {s.localSavedAt && <> · 자동 저장 {timeStr(s.localSavedAt)}</>}
      </span>
      {showVersions && <Versions onClose={() => setShowVersions(false)} />}
    </div>
  );
}

function Versions({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<Snapshot[] | null>(null);
  const reload = () => snapList().then(setList).catch(() => setList([]));
  useEffect(() => void reload(), []);

  const restore = async (v: Snapshot) => {
    if (!confirm(`"${v.memo}" 버전으로 되돌릴까요?\n지금 상태는 "복원 전 자동 백업"으로 남겨 둬요.`)) return;
    const s = useStore.getState();
    await snapAdd('복원 전 자동 백업', s.project);
    s.load(structuredClone(v.project), { dirty: true });
    s.say(`"${v.memo}" 버전으로 되돌렸어요`);
    onClose();
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>버전 목록</h3>
        <p className="tip">이 브라우저 안에만 저장돼요. 중요한 시점에는 [저장]으로 파일도 남겨 주세요.</p>
        {!list && <p>불러오는 중…</p>}
        {list?.length === 0 && <p className="tip">저장된 버전이 없어요.</p>}
        {list?.map((v) => (
          <div className="ver" key={v.id}>
            <span className="when">{new Date(v.time).toLocaleString('ko-KR')}</span>
            <span className="memo">{v.memo}</span>
            <span className="tip">{v.project.nodes.length}상자</span>
            <button onClick={() => restore(v)}>복원</button>
            <button className="danger" onClick={() => confirm('이 버전을 지울까요?') && snapDelete(v.id).then(reload)}>삭제</button>
          </div>
        ))}
        <div className="row end">
          <button onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
