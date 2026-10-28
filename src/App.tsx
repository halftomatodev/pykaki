import { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Toolbar } from './Toolbar';
import { Sidebar } from './Sidebar';
import { Canvas } from './Canvas';
import { RightPanel } from './Panels';
import { useStore } from './store';
import { exportRpyFile, saveProject } from './files';
import { isTyping } from './util';

export function App() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 's') {
        e.preventDefault();
        saveProject(e.shiftKey);
      } else if (k === 'e') {
        e.preventDefault();
        exportRpyFile(true);
      } else if (!isTyping(e.target) && (k === 'z' || k === 'y')) {
        e.preventDefault();
        const s = useStore.getState();
        if (k === 'y' || (k === 'z' && e.shiftKey)) s.redo();
        else s.undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <ReactFlowProvider>
      <div className="app">
        <Toolbar />
        <div className="main">
          <Sidebar />
          <Canvas />
          <RightPanel />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
