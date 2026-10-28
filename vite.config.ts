import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 빌드 결과를 dist/index.html 한 파일로 묶는다 (더블클릭 실행, GitHub Pages 배포 둘 다 가능)
export default defineConfig({
  base: './',
  // Dropbox 폴더 안에 캐시를 두면 동기화가 파일을 잠가서 개발 서버가 멈춘다
  cacheDir: join(tmpdir(), 'pykaki-vite'),
  plugins: [react(), viteSingleFile()],
});
