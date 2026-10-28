import { useMemo } from 'react';
import { useStore, type Tab } from './store';
import { Inspector } from './Inspector';
import { Player } from './Player';
import { generateRpy } from './exportRpy';
import { exportRpyFile } from './files';

export function RightPanel() {
  const tab = useStore((s) => s.tab);
  const project = useStore((s) => s.project);
  const playing = useStore((s) => s.playing);
  const { code, warnings } = useMemo(() => generateRpy(project), [project]);
  const errors = warnings.filter((w) => w.level === 'error').length;
  const setTab = (t: Tab) => useStore.setState({ tab: t });

  return (
    <div className="right">
      <div className="tabs">
        <button className={tab === 'edit' ? 'on' : ''} onClick={() => setTab('edit')}>편집</button>
        <button className={tab === 'play' ? 'on' : ''} onClick={() => setTab('play')}>플레이{playing && ' ●'}</button>
        <button className={tab === 'warn' ? 'on' : ''} onClick={() => setTab('warn')}>
          검사 {warnings.length > 0 && <span className={'count' + (errors ? ' err' : '')}>{warnings.length}</span>}
        </button>
        <button className={tab === 'rpy' ? 'on' : ''} onClick={() => setTab('rpy')}>스크립트</button>
      </div>
      <div className="tab-body" hidden={tab !== 'edit'}>
        <Inspector />
      </div>
      {/* 플레이 상태를 유지하려고 탭을 바꿔도 지우지 않는다 */}
      <div className="tab-body" hidden={tab !== 'play'}>
        <Player active={tab === 'play'} />
      </div>
      {tab === 'warn' && (
        <div className="tab-body">
          {!warnings.length && <p className="tip">문제가 없어요.</p>}
          {warnings.map((w, i) => (
            <div
              key={i}
              className={'warn-item ' + w.level}
              onClick={() => {
                if (!w.nodeId) return;
                useStore.getState().select([w.nodeId]);
                useStore.getState().focusNodes([w.nodeId]);
              }}
            >
              {w.level === 'error' ? '⛔ ' : '⚠ '}
              {w.msg}
            </div>
          ))}
        </div>
      )}
      {tab === 'rpy' && (
        <div className="tab-body">
          <div className="row">
            <button onClick={() => navigator.clipboard.writeText(code).then(() => useStore.getState().say('복사했어요'))}>복사</button>
            <button className="primary" onClick={() => exportRpyFile(false)}>.rpy 내보내기</button>
          </div>
          <pre className="rpy">{code}</pre>
        </div>
      )}
    </div>
  );
}
