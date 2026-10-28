# PyKaki

상자와 선으로 렌파이 대본을 쓰고 `.rpy`로 내보내는 도구.

- 사용 가이드: [docs/GUIDE.md](docs/GUIDE.md)
- 개발 명세: [docs/SPEC.md](docs/SPEC.md)

## 그냥 쓰기

`dist/index.html`을 크롬이나 엣지로 열면 돼요. 설치는 필요 없어요.
(크롬/엣지에서는 같은 파일에 덮어쓰기 저장과 게임 폴더로 바로 내보내기가 돼요.)

## 고치고 다시 만들기

```bash
npm install      # 처음 한 번
npm run dev      # 개발 서버 (http://localhost:5173)
npm run build    # dist/index.html 다시 만들기
```

## 저장 방식

- 자동 저장: 브라우저 안(IndexedDB). 브라우저 데이터를 지우면 사라져요.
- 버전 저장: 툴바 [버전 저장]/[버전 목록]. 이것도 브라우저 안이에요.
- **파일 저장(Ctrl+S)이 진짜 백업**이에요. `.flow.json` 파일을 Dropbox 폴더에 두세요.

## 파일 구조

| 파일 | 역할 |
|---|---|
| `src/types.ts` | 저장 파일(JSON) 구조 |
| `src/ops.ts` | 상자·선·label 편집 함수 |
| `src/exportRpy.ts` | `.rpy` 변환과 검사 |
| `src/layout.ts` | 자동 정렬 (ELK) |
| `src/playEngine.ts` | 테스트 플레이 흐름 엔진 |
| `src/Canvas.tsx`, `BoxView.tsx` | 상자와 선 화면 |
| `src/Inspector.tsx` | 오른쪽 편집 패널 |
| `src/Player.tsx` | 테스트 플레이 화면 |
