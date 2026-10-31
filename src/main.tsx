import { createRoot } from 'react-dom/client';
import '@xyflow/react/dist/style.css';
import './styles.css';
import { App } from './App';
import { useStore } from './store';
import { AUTO_MEMO, kvGet, kvSet, snapAuto } from './persist';
import { folderReady, pullInbox, restoreFolder } from './gameFolder';
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

  // 저장본: 바뀐 것이 있으면 5분마다 남긴다
  let lastSnap = useStore.getState().project;
  setInterval(() => {
    const cur = useStore.getState().project;
    if (cur === lastSnap) return;
    lastSnap = cur;
    snapAuto(AUTO_MEMO, cur).catch((e) => console.warn('자동 저장본 실패', e));
  }, 5 * 60 * 1000);

  // 렌파이에서 돌아오면 showpy가 넣은 줄을 바로 대본에 보여 준다
  await restoreFolder();
  const pull = () => void (folderReady() && pullInbox().catch((e) => console.warn('받아 적기 실패', e)));
  window.addEventListener('focus', pull);
  pull();

  window.addEventListener('beforeunload', (e) => {
    if (useStore.getState().dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  createRoot(document.getElementById('root')!).render(<App />);
}

boot();
