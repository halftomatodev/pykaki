import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './styles.css';
import { App } from './App';
import { useStore } from './store';
import { kvGet, kvSet } from './persist';
import { createSample, normalizeProject } from './sample';

async function boot() {
  let saved: any = null;
  let meta: any = null;
  try {
    saved = await kvGet('current');
    meta = await kvGet('meta');
  } catch (e) {
    console.warn('브라우저 저장소를 쓸 수 없어요', e);
  }
  let project;
  try {
    project = saved ? normalizeProject(saved) : createSample();
  } catch {
    project = createSample();
  }
  useStore.getState().load(project, { fileName: meta?.fileName ?? null, dirty: meta?.dirty ?? false });

  // 자동 저장: 바뀌고 0.7초 뒤 IndexedDB에
  let timer: ReturnType<typeof setTimeout> | undefined;
  useStore.subscribe((s, prev) => {
    if (s.project === prev.project && s.fileName === prev.fileName && s.dirty === prev.dirty) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const st = useStore.getState();
      try {
        await kvSet('current', st.project);
        await kvSet('meta', { fileName: st.fileName, dirty: st.dirty });
        useStore.setState({ localSavedAt: Date.now() });
      } catch (e) {
        console.warn('자동 저장 실패', e);
      }
    }, 700);
  });

  window.addEventListener('beforeunload', (e) => {
    if (useStore.getState().dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  createRoot(document.getElementById('root')!).render(<App />);
}

boot();
