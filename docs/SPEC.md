# PyKaki — 개발 명세서

지금 구현된 상태를 기준으로 정리한 명세예요. 처음 설계 문서(`../RENPY_FLOW_EDITOR_SPEC.md`)와 다른 곳은 이 문서가 맞아요.

- 사이트: https://halftomatodev.github.io/pykaki/
- 저장소: https://github.com/halftomatodev/pykaki
- 사용자 가이드: [GUIDE.md](GUIDE.md)

## 1. 목적과 원칙

- Twine처럼 **상자와 선**으로 렌파이 대본의 흐름을 보며 쓰고, `.rpy`로 내보낸다.
- **원본은 툴의 JSON 파일**(`*.flow.json`)이다. `.rpy`는 결과물이다. 내보내기는 단방향이다.
- 서버가 없다. 모든 동작은 브라우저 안에서 일어나고, 대본은 사용자 PC에만 있다.

## 2. 기술 구성

| 항목 | 사용 |
|---|---|
| 화면 | React 18 + TypeScript |
| 상자/선 캔버스 | `@xyflow/react` 12 (React Flow) |
| 상태 관리 | `zustand` (실행 취소/다시 실행 포함) |
| 자동 정렬 | `elkjs` (layered 알고리즘) |
| 빌드 | Vite 5 + `vite-plugin-singlefile` → `dist/index.html` 한 파일 |
| 배포 | GitHub Actions → GitHub Pages (`main`에 push하면 자동) |
| 브라우저 저장 | IndexedDB (자동 저장, 버전 스냅샷) |
| 파일 저장 | File System Access API (크롬/엣지), 그 외 브라우저는 다운로드 |

## 3. 화면 구성

```
┌ 툴바: 새로 열기 저장 다른이름 │ 버전 저장/목록 │ +상자 정렬(전체/label/선택) 방향 │ ↶↷ │ ▶플레이 .rpy 내보내기 ┐
├ 왼쪽 ───────┬ 캔버스 ─────────────────────────┬ 오른쪽 탭 ────────────┤
│ 프로젝트 제목 │ label 묶음 배경(프레임)           │ 편집: 선택한 상자 설정 │
│ 캐릭터 목록   │ 상자(노드), 선(엣지)              │ 플레이: 테스트 플레이  │
│ label 목록    │ 미니맵, 확대/축소                │ 검사: 경고/오류 목록   │
│ 설정(이스케이프)│                                  │ 스크립트: .rpy 미리보기│
└──────────────┴──────────────────────────────────┴───────────────────────┘
```

## 4. 데이터 구조 (`src/types.ts`)

```jsonc
{
  "format": "renpy-flow",
  "version": 1,
  "project": { "title": "내 게임", "startNode": "n1" },
  "characters": [{ "id": "a", "name": "앨리스", "color": "#ff8fb1" }],
  "variables": [],                          // 2단계(플래그)용 자리
  "labels": [{ "id": "g1", "name": "scene_rain", "title": "비 오는 날", "color": "#dbeafe", "entry": "n1" }],
  "layout": { "direction": "TB" },          // TB | LR
  "settings": { "escapeBrackets": true, "allowTextTags": true, "escapePercent": false },
  "nodes": [{
    "id": "n1", "group": "g1", "title": "도입", "pos": { "x": 0, "y": 0 },
    "lines": [
      { "id": "l1", "type": "narration", "text": "비가 내렸다." },
      { "id": "l2", "type": "say", "who": "a", "attr": "smile", "text": "우산 있어?" },
      { "id": "l3", "type": "command", "text": "show alice smile" },
      { "id": "l4", "type": "note", "text": "작가 메모" }
    ],
    "exit": { "type": "next", "target": "n2" }
  }]
}
```

- **상자(node)**: 대사 묶음 하나. 반드시 label 그룹 하나(`group`)에 속한다.
- **label 그룹**: 렌파이 `label` 하나. 상자 여러 개를 묶는다. `entry`가 그 label의 첫 상자다.
- **줄(line) 종류**: `narration`(내레이션), `say`(캐릭터 대사, `who`=캐릭터 id, `attr`=표정 등), `command`(렌파이 명령 그대로), `note`(주석).
- **나가는 방식(exit)**:
  - `next` `{ target }`: 다음 상자로
  - `menu` `{ choices: [{ id, text, target, mode:"jump", condition:null, actions:[] }] }`: 선택지
  - `call` `{ target, then }`: target을 call하고, 돌아오면 then으로. then이 없으면 return
  - `return`: 끝
- `condition`, `actions`, `variables`는 2단계(플래그)를 위해 비워 둔 자리다. 지금은 쓰지 않는다.
- id는 툴이 만든다(`n`/`l`/`c`/`g` + 영숫자 6자). 로컬 label 이름으로도 쓰이므로 영문 식별자 규칙을 지킨다.
- 불러올 때 `normalizeProject()`가 빠진 값을 채우고, 그룹이 없는 상자를 첫 그룹에 넣는다.

## 5. `.rpy` 내보내기 규칙 (`src/exportRpy.ts`)

1. 머리말 주석과 `define 캐릭터id = Character("이름", color="#...")`.
2. 시작: `label start:` → `jump 시작상자`. 단, 이름이 `start`인 label이 있으면 그 label의 첫 상자가 시작 상자여야 하고, 감싸는 label을 만들지 않는다.
3. **label 그룹마다 `label 이름:` 하나.** 그룹 안 상자 순서는 다음과 같다.
   - 첫 상자(`entry`)부터 시작해서, `next`나 call의 `then`으로 이어지는 같은 그룹 상자를 바로 뒤에 붙인다.
   - 나머지는 그룹 안에서 너비 우선으로 방문한 순서를 따른다.
4. 바로 앞 상자에서만 이어져 들어오는 상자는 label 없이 이어 쓴다(jump 생략). 그 외(선택지, jump, call로 들어오는 상자)에는 **로컬 label** `label 그룹이름.상자id:`를 붙인다.
5. 대상 참조: 그룹의 첫 상자면 `그룹이름`, 아니면 `그룹이름.상자id`.
6. 줄 출력:
   - 내레이션: `"텍스트"`
   - 대사: `id 속성 "텍스트"`
   - 명령: 여러 줄을 그대로 출력(끝 공백만 제거)
   - 메모: `# ...`
7. 텍스트 이스케이프: `\`→`\\`, `"`→`\"`. 설정에 따라 `[`→`[[`, `{`→`{{`(텍스트 태그 끔), `%`→`%%`. 줄바꿈은 `\n`.
8. 나가는 방식 출력:
   - `next`: 다음 상자가 바로 뒤에 놓였으면 생략, 아니면 `jump`. 연결이 없으면 `return  # TODO: 연결 안 됨`.
   - `menu`: `menu:` 아래 항목마다 `jump`.
   - `call`: `call 대상` 다음 줄은 then을 next와 같은 규칙으로 처리하고, then이 없으면 `return`.
9. 본문이 비면 `pass`를 넣는다. 각 상자 위에 `# @node:id 제목` 주석을 붙인다(나중에 역가져오기용).
10. **검사(경고/오류)**:
    - label 이름과 캐릭터 id의 형식 오류, 예약어, 중복
    - 시작 상자 없음
    - 등록되지 않은 화자
    - 빈 대사나 빈 선택지
    - 연결 안 된 선
    - 시작에서 도달할 수 없는 상자
    - call 대상에서 return에 도달하지 않음

## 6. 자동 정렬 (`src/layout.ts`)

- **전체 정렬**: ELK 계층 그래프로 배치한다. label 그룹이 부모 노드가 되어 같은 label 상자가 한 덩어리로 모인다.
- **label 정렬 / 선택 정렬**: 해당 상자만 평면으로 배치하고, 왼쪽 위 위치는 유지한다.
- **흐름 순서**: 시작 상자부터 너비 우선으로 방문한 순서로 노드와 그룹을 ELK에 넘긴다. 그래서 선택지 순서대로 좌→우로 놓인다.
- **되돌아가는 선(루프)**: 깊이 우선으로 찾은 back edge는 정렬 계산에서 뺀다. ELK의 cycleBreaking 옵션은 계층 그래프에서 기대대로 동작하지 않았다.
- 정렬 결과는 `update()`로 반영되므로 실행 취소가 되고, 0.4초 이동 애니메이션이 붙는다.

## 7. 테스트 플레이 (`src/playEngine.ts`, `src/Player.tsx`)

- 상태: 현재 상자, 줄 위치, call 스택(`{from, to}`), 선택지, 표시 중인 줄, 명령 뱃지, 종료 사유, 방문한 상자와 선.
- `advance()`는 다음 표시할 줄까지 진행한다.
  - 메모는 건너뛴다.
  - 명령은 뱃지로만 쌓는다.
  - 나가는 방식은 jump, menu, call, return 규칙대로 따라간다.
  - 무한 반복은 5000단계에서 멈춘다.
- 종료 사유: `end`(return), `broken`(연결 없음), `missing`(없는 상자), `loop`.
- 텍스트 태그 일부를 흉내 낸다: `{b} {i} {u} {s} {color=} {size=} {p} {w} {nw} {fast} {a=}`, `{{`.
- 플레이 중인 상자는 캔버스에 강조되고 화면이 따라간다. 지나온 선은 주황색이다.
- 탭을 바꿔도 플레이 상태를 유지한다(컴포넌트를 숨길 뿐 지우지 않음). 플레이 중 대본을 고치면 다음 줄부터 반영된다.

## 8. 편집 동작

- **상자 더블클릭**: 상자 안에서 바로 편집한다(`store.inlineEdit`).
  - 누른 곳의 `data-part`(줄 id, `title`, 선택지 id)로 커서가 간다.
  - 끝내는 방법: Esc, [완료], 빈 곳 클릭, 다른 상자 선택.
  - 입력칸 안의 더블클릭은 무시한다(단어 선택).
- **상자 한 번 클릭**: 오른쪽 편집 탭에서 label, 다음 흐름, 시작 상자 등을 설정한다.
- **Ctrl+Enter**: 같은 화자로 새 줄을 만든다. `flushSync`로 즉시 그려서 바로 이어 쳐도 글자가 새 줄에 들어간다.
- **빈 곳 더블클릭**: 새 상자를 만든다. label 프레임 안이면 그 label에 넣는다.
- **선을 빈 곳에 놓기**: 새 상자를 만들어 연결한다. 상자 몸통에 놓으면 그 상자에 연결한다.
- **선 더블클릭**: next ↔ call을 전환한다.
- **Delete**: 상자나 선을 삭제한다.
- **Shift+드래그**: 여러 상자를 선택한다.
- **단축키**: Ctrl+S 저장, Ctrl+Shift+S 다른 이름으로 저장, Ctrl+E 같은 곳에 다시 내보내기, Ctrl+Z/Y 실행 취소/다시 실행(입력칸 밖에서).
- 실행 취소: 같은 key로 1.2초 안에 이어지는 변경(타이핑)은 한 번으로 묶는다. 최대 100단계.

## 9. 저장

| 층 | 방식 | 위치 |
|---|---|---|
| 자동 저장 | 변경 0.7초 뒤 | IndexedDB `renpy-flow-editor` / `kv.current` |
| 버전 스냅샷 | [버전 저장], 열기/새로/복원 직전 자동 | IndexedDB `snapshots` |
| 파일 | Ctrl+S, `.flow.json` | 사용자 폴더 (진짜 백업) |
| `.rpy` | 내보내기, 핸들 기억 → Ctrl+E로 같은 곳 | 게임 `game/` 폴더 권장 |

- 파일로 저장하지 않은 변경이 있으면 탭을 닫을 때 경고한다.
- 사이트와 로컬 `dist/index.html`은 출처(origin)가 달라서 자동 저장 공간이 따로다.

## 10. 소스 구조

| 파일 | 역할 |
|---|---|
| `src/types.ts` | 데이터 구조 |
| `src/ops.ts` | 편집 함수 (연결, 상자/그룹 추가, 삭제, 나가는 방식 변경, 화자 변경) |
| `src/store.ts` | zustand 상태, 실행 취소, 선택, 플레이 상태, 상자 안 편집 상태 |
| `src/sample.ts` | 예제/빈 프로젝트, 불러오기 정규화 |
| `src/persist.ts` | IndexedDB |
| `src/files.ts` | 파일 열기/저장/`.rpy` 내보내기 |
| `src/exportRpy.ts` | `.rpy` 변환과 검사 |
| `src/layout.ts` | 자동 정렬 |
| `src/playEngine.ts` | 플레이 엔진 (Windows는 대소문자를 구분하지 않아서 `Player.tsx`와 이름을 다르게 함) |
| `src/actions.ts` | 정렬 실행, 상자 추가, 상자 더블클릭 편집, 포커스 |
| `src/Canvas.tsx` | React Flow 캔버스, label 프레임, 선 |
| `src/BoxView.tsx` | 상자 표시와 상자 안 편집 |
| `src/Inspector.tsx` | 오른쪽 편집 탭 |
| `src/Player.tsx` | 플레이 화면 |
| `src/Panels.tsx` | 오른쪽 탭, 검사, 스크립트 미리보기 |
| `src/Toolbar.tsx`, `src/Sidebar.tsx` | 툴바, 버전 목록, 왼쪽 패널 |
| `src/textTags.tsx` | 텍스트 태그 표시 |

## 11. 남은 단계

- **2단계 (플래그)**:
  - `variables` → `default 이름 = 값`
  - 선택지/상자 동작 → `$ 이름 = 값`
  - 선택지 조건 → `"텍스트" if 조건:`
  - 조건 분기 상자 → `if/elif/else` + `jump`
  - 플레이에서 변수 보기와 바꾸기
- **3단계**:
  - `# @node:` 주석으로 `.rpy` 대사 수정분 다시 가져오기
  - 플레이에서 이미지 간이 표시
  - PWA
- **미검증**: 내보낸 `.rpy`를 실제 렌파이에서 실행해 보지 않았다(특히 로컬 label `label 그룹.id:` 형식).
