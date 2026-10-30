// 웹앱 설치(PWA). 사이트에서만 동작하고, 파일로 연 dist/index.html에서는 아무것도 하지 않는다
import { useEffect, useState } from 'react';

let prompt: any = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

if (location.protocol.startsWith('http') && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('서비스 워커 등록 실패', e));
}

// 설치할 수 있게 되면 브라우저가 알려 준다. 툴바의 [앱 설치]로 띄우려고 잡아 둔다
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  prompt = e;
  notify();
});
window.addEventListener('appinstalled', () => {
  prompt = null;
  notify();
});

export async function installApp() {
  if (!prompt) return;
  prompt.prompt();
  await prompt.userChoice;
  prompt = null;
  notify();
}

export function useCanInstall() {
  const [can, setCan] = useState(!!prompt);
  useEffect(() => {
    const f = () => setCan(!!prompt);
    listeners.add(f);
    return () => void listeners.delete(f);
  }, []);
  return can;
}
