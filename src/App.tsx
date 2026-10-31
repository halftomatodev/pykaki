import { useEffect } from 'react';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { Toolbar } from './Toolbar';
import { Sidebar } from './Sidebar';
import { Canvas } from './Canvas';
import { RightPanel } from './Panels';
import { SettingsModal } from './SettingsModal';
import { EditCaret } from './Caret';
import { useStore } from './store';
import { exportRpyFile, saveProject } from './files';
import { addBoxCenter, enterFullPlay, goNextBox, leaveFullPlay, toggleFocus } from './actions';
import { hit } from './prefs';
import { isTyping } from './util';

// 단축키는 환경 설정에서 바꿀 수 있다 (prefs.ts)
function Keys() {
  const rf = useReactFlow();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      const run = (fn: () => void) => (e.preventDefault(), fn());
      if (hit(e, 'fullPlay')) run(() => void (s.fullPlay ? leaveFullPlay() : enterFullPlay()));
      else if (s.fullPlay) return; // 전체화면에서는 플레이 키만 쓴다
      else if (hit(e, 'focus')) run(toggleFocus);
      else if (s.inlineEdit && hit(e, 'nextBox')) run(() => goNextBox(s.inlineEdit!));
      else if (s.inlineEdit && hit(e, 'flowMenu')) run(() => useStore.setState({ flowMenu: !s.flowMenu }));
      else if (hit(e, 'save')) run(() => saveProject());
      else if (hit(e, 'saveAs')) run(() => saveProject(true));
      else if (hit(e, 'export')) run(() => exportRpyFile(true));
      else if (hit(e, 'newBox')) run(() => addBoxCenter(rf));
      else if (hit(e, 'play')) run(() => s.startPlay(null));
      // 입력칸 안에서는 브라우저의 글자 되돌리기를 쓴다
      else if (!isTyping(e.target) && hit(e, 'undo')) run(s.undo);
      else if (!isTyping(e.target) && hit(e, 'redo')) run(s.redo);
    };
    window.addEventListener('keydown', onKey);
    // 브라우저가 Esc로 전체화면을 끄면 편집 화면으로 돌아간다
    let wasFull = false;
    const onFull = () => {
      if (document.fullscreenElement) wasFull = true;
      else if (wasFull) {
        wasFull = false;
        leaveFullPlay();
      }
    };
    document.addEventListener('fullscreenchange', onFull);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFull);
    };
  }, [rf]);
  return null;
}

export function App() {
  const focus = useStore((s) => s.focusMode);
  const showPrefs = useStore((s) => s.showPrefs);
  const flash = useStore((s) => s.flash);

  return (
    <ReactFlowProvider>
      <Keys />
      <div className={'app' + (focus ? ' focus' : '')}>
        <Toolbar />
        <div className="main">
          <Sidebar />
          <Canvas />
          <RightPanel />
        </div>
      </div>
      {flash && <div className="toast">{flash}</div>}
      {showPrefs && <SettingsModal />}
      <EditCaret />
    </ReactFlowProvider>
  );
}
