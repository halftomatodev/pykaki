# PyKaki

렌파이 대본을 상자와 선으로 쓰고 `.rpy`로 내보내는 웹 에디터. 사용자는 한국어로 대화한다.

- 구현 명세: [docs/SPEC.md](docs/SPEC.md) — 작업 전에 먼저 읽기
- 사용자 가이드: [docs/GUIDE.md](docs/GUIDE.md) — 기능을 바꾸면 같이 고치기
- 배포: `main`에 push하면 GitHub Actions가 GitHub Pages에 배포 (https://halftomatodev.github.io/pykaki/)

## 명령

```bash
npm run dev        # 개발 서버 http://localhost:5173
npx tsc --noEmit   # 타입 검사
npm run build      # dist/index.html 한 파일로 빌드
```

## 꼭 지킬 것

- 기능을 고친 뒤에는 **`npm run build`로 로컬 `dist/index.html`도 다시 만든다.** 사용자가 그 파일을 직접 열어 쓴다.
- 작업 폴더는 Dropbox 밖의 `F:\SHOWPY\pykaki`다. 저장소를 Dropbox 안에 두지 않는다. Vite 캐시는 `vite.config.ts`의 `cacheDir`로 임시 폴더에 둔다(Dropbox 안에서 돌릴 때도 EBUSY로 개발 서버가 멈추지 않게).
- Windows는 파일 이름 대소문자를 구분하지 않는다. `Player.tsx`가 있으니 엔진 파일은 `playEngine.ts`처럼 다른 이름을 쓴다.
- 커밋 작성자는 `halftomato <wwonwan@naver.com>`, GitHub 계정은 `halftomatodev`. 이 저장소의 git 설정에 `http.sslBackend=schannel`과 gh 자격 증명이 들어 있어 push가 된다.
- 저장 파일 형식(`src/types.ts`)을 바꿀 때는 `normalizeProject()`에서 예전 파일도 열리게 한다.
- 원본은 툴의 JSON이고 `.rpy`는 결과물이다(단방향). showpy에서 넣은 그림, 소리 줄만 `showpy_inbox.json`으로 받아 적는다. 형식은 [docs/LINK.md](docs/LINK.md). 바꾸면 showpy 저장소의 같은 파일도 고친다.
- 이름은 PyKaki지만, 저장 형식 `"format": "renpy-flow"`·`.flow.json`과 IndexedDB 이름 `renpy-flow-editor`는 일부러 예전 이름 그대로다(바꾸면 기존 대본 파일과 자동 저장을 못 읽음). 바꾸지 말 것.
