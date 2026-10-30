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
    "id": "n1", "group": "g1", "title": "도입", "pos": { "x": 0, "y": 0 }, "color": "#ff9500", // color는 없어도 됨
    "lines": [
      { "id": "l1", "type": "narration", "text": "비가 내렸다." },
      { "id": "l2", "type": "say", "who": "a", "attr": "smile", "text": "우산 있어?" },
      { "id": "l3", "type": "show", "text": "", "kind": "char", "who": "a", "attr": "smile", "at": "left", "trans": "dissolve" },
      { "id": "l5", "type": "music", "text": "", "file": "rain.ogg" },
      { "id": "l6", "type": "command", "text": "with vpunch" },
      { "id": "l4", "type": "note", "text": "작가 메모" }
    ],
    "exit": { "type": "next", "target": "n2" }
  }]
}
```

- **상자(node)**: 대사 묶음 하나. 반드시 label 그룹 하나(`group`)에 속한다. `color`(선택)는 상자 색으로, 없으면 label 색을 따른다. `.rpy`에는 영향이 없다.
- **label 그룹**: 렌파이 `label` 하나. 상자 여러 개를 묶는다. `entry`가 그 label의 첫 상자다.
- **줄(line) 종류**: `narration`(내레이션), `say`(캐릭터 대사, `who`=캐릭터 id, `attr`=표정 등), 연출 줄 5가지, `command`(렌파이 명령 그대로), `note`(주석).
- **연출 줄** (`src/stage.ts`): 명령을 직접 쓰지 않고 칸을 채운다. `text`는 쓰지 않는다.
  - `scene` `{ image, trans }`: 배경 이름(`bg` 뒤), 전환
  - `show` `{ kind, who, attr, image, at, trans }`: `kind`는 `char`(who+attr) | `bg`(image) | `etc`(image), 위치 `left`/`right`(비우면 가운데)
  - `hide` `{ kind, who, image, trans }`
  - `music` `{ file, stop }`, `sound` `{ file }`
  - `trans`는 `dissolve` | `fade` | 비움. 모두 선택 칸이라 예전 파일은 그대로 열린다.
- **나가는 방식(exit)**:
  - `next` `{ target }`: 다음 상자로
  - `menu` `{ choices: [{ id, text, target, mode:"jump", condition:null, actions:[] }] }`: 선택지
  - `call` `{ target, then }`: target을 call하고, 돌아오면 then으로. then이 없으면 return
  - `return`: 끝
- `condition`, `actions`, `variables`는 2단계(플래그)를 위해 비워 둔 자리다. 지금은 쓰지 않는다.
- id는 툴이 만든다(`n`/`l`/`c`/`g` + 영숫자 6자). 로컬 label 이름으로도 쓰이므로 영문 식별자 규칙을 지킨다.
- 불러올 때 `normalizeProject()`가 빠진 값을 채우고, 그룹이 없는 상자를 첫 그룹에 넣는다.

## 5. `.rpy` 내보내기 규칙 (`src/exportRpy.ts`)

1. 머리말 주석과 `define 캐릭터id = Character("이름", color="#...", image="캐릭터id")`. `image`가 있어야 대사 속성(`a smile "..."`)과 `show a smile`이 같은 그림을 쓴다.
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
   - 연출: `scene bg 이름 [with 전환]`(이름이 비면 `scene`), `show 이미지 [at 위치] [with 전환]`, `hide 태그 [with 전환]`, `play music "audio/파일"`, `stop music fadeout 1.0`, `play sound "audio/파일"`. 이미지는 배경 `bg 이름`, 캐릭터 `캐릭터id 표정`, 기타 이름 그대로. 파일 이름에 `/`가 있으면 앞에 `audio/`를 붙이지 않는다. 칸이 덜 채워지면 `# TODO: 이유`를 쓰고 경고한다.
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
    - 덜 채운 연출 줄, 등록되지 않은 캐릭터, 영문이 아닌 이미지 이름
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
  - 명령과 연출 줄은 뱃지로만 쌓는다(연출 줄은 내보낼 명령으로 표시).
  - 나가는 방식은 jump, menu, call, return 규칙대로 따라간다.
  - 무한 반복은 5000단계에서 멈춘다.
- 종료 사유: `end`(return), `broken`(연결 없음), `missing`(없는 상자), `loop`.
- 텍스트 태그 일부를 흉내 낸다: `{b} {i} {u} {s} {color=} {size=} {p} {w} {nw} {fast} {a=}`, `{{`.
- 플레이 중인 상자는 캔버스에 강조되고 화면이 따라간다. 지나온 선은 주황색이다.
- 탭을 바꿔도 플레이 상태를 유지한다(컴포넌트를 숨길 뿐 지우지 않음). 플레이 중 대본을 고치면 다음 줄부터 반영된다.

## 8. 편집 동작

- **상자 더블클릭**: 상자 안에서 바로 편집한다(`store.inlineEdit`).
  - **볼 때와 같은 모양**: 상자 폭(250px), 글자 크기, 줄 배치가 같다. 같은 `LineRow`가 보기에서는 글자를, 편집에서는 테두리·여백 없는 `textarea`(`.ed`)를 같은 자리에 그린다. 보기 화면도 줄 수와 줄 길이를 자르지 않는다.
  - **줌인**: 편집을 시작하면 지금 화면(viewport)을 기억하고, 상자와 양옆 단추 자리가 들어오도록 확대(최대 1.6배, 지금보다 작게는 안 함)하며 0.45초 동안 이동한다. 끝내면 기억한 화면으로 돌아간다. 집중 모드를 바꾸면 다시 맞춘다.
  - **옆에 붙는 단추**: 지금 줄(`active`, 포커스를 받은 줄)의 높이에 맞춰 상자 왼쪽 바깥에 손잡이·줄 종류·표정·＋·✕ 묶음, 연출 줄이면 오른쪽 바깥에 `StageFields` 카드가 붙는다. 줄을 옮기면 `top`이 0.22초 동안 따라 움직인다. 연출 줄은 줄 자체가 `tabIndex`로 포커스를 받는다.
  - **다음 흐름 창** (`src/FlowMenu.tsx`): 편집 중 상자 오른쪽 바깥, 다음 흐름 줄 높이(연출 입력칸과 겹치면 그 아래)에 붙는 반투명(바탕 62%, 배경 흐림) 창. 선택칸 없이 항목을 모두 펼친다: 흐름 종류 4가지, 이어지는 곳(선마다, 고르면 상자 목록 단계로), 선택지 추가, 바로 가기(이어 쓰기, 새 상자에 이어 쓰기). 기본 Alt+Enter(`flowMenu`, 바꿀 수 있음)로 들어가면 숨은 입력칸이 키를 받아 ↑↓/Enter·→/←·Backspace/Esc로 움직이고, 상자 목록 단계에서는 그 칸이 찾기 칸이 된다. 나가면 들어오기 전의 글 칸으로 커서를 돌려준다. 마우스로도 누를 수 있다.
  - **다음 상자로 이어 쓰기** (`goNextBox`, 기본 Ctrl+Shift+Enter): `next`/call의 `then`이 이어져 있으면 그 상자를 편집, 없으면 `continueInNewBox`로 같은 label에 새 상자를 만들어 잇고 편집한다. 새 상자는 흐름 방향(TB면 아래, LR이면 오른쪽)에 놓고, 다른 상자와 겹치면 60px씩 비켜 놓는다. 선택지 상자는 카드에서 고른다.
  - 누른 곳의 `data-part`(줄 id, `title`, 선택지 id)로 커서가 간다.
  - 끝내는 방법: Esc, 빈 곳 클릭, 다른 상자 선택.
  - 입력칸 안의 더블클릭은 무시한다(단어 선택).
- **상자 한 번 클릭**: 오른쪽 편집 탭에서 label, 다음 흐름, 시작 상자 등을 설정한다.
- **줄 순서**: ⠿ 손잡이를 끌어 다른 줄의 위/아래 절반에 놓는다(HTML 드래그 앤 드롭, `useLineDrag`). 상자 안 편집과 편집 탭 모두.
- **편집 탭 줄 모양**: 줄마다 2칸 격자. 왼쪽 칸(136px)에 손잡이·줄 종류·✕와 대사 속성, 오른쪽 칸에 글(또는 연출 입력칸)을 두고 사이에 세로 선을 긋는다.
- **Ctrl+Enter**: 같은 화자로 새 줄을 만든다. `flushSync`로 즉시 그려서 바로 이어 쳐도 글자가 새 줄에 들어간다.
- **빈 곳 더블클릭**: 새 상자를 만든다. label 프레임 안이면 그 label에 넣는다.
- **선을 빈 곳에 놓기**: 새 상자를 만들어 연결한다. 상자 몸통에 놓으면 그 상자에 연결한다.
- **선 더블클릭**: next ↔ call을 전환한다.
- **Delete**: 상자나 선을 삭제한다.
- **Shift+드래그**: 여러 상자를 선택한다.
- **단축키(기본값)**: Ctrl+\\ 집중 모드, Ctrl+Enter 새 줄, Ctrl+Shift+Enter 다음 상자로 이어 쓰기, Alt+Enter 다음 흐름 창, Ctrl+S 저장, Ctrl+Shift+S 다른 이름으로 저장, Ctrl+E 같은 곳에 다시 내보내기, Ctrl+Z/Y 실행 취소/다시 실행(입력칸 밖에서), Alt+N 새 상자, Alt+P 플레이. 8-1 참고.
- 실행 취소: 같은 key로 1.2초 안에 이어지는 변경(타이핑)은 한 번으로 묶는다. 최대 100단계.

## 8-1. 화면, 집중 모드, 환경 설정

- **눈에 덜 띄는 화면**: 버튼은 테두리 없이 흐린 글자, 입력칸은 테두리 없이 옅은 바탕. 툴바와 미니맵/확대 버튼은 평소 흐리고 마우스를 올리면 또렷해진다. 줄의 ✕ 버튼은 줄에 마우스를 올렸을 때만 보인다.
- **색 (`src/prefs.ts`)**: `--bg`(바탕) `--panel`(면) `--text`(글자) `--accent`(강조) 네 가지만 정하고, 테두리·흐린 글자·줄 종류 바탕은 CSS `color-mix()`로 이 넷에서 만든다. 프리셋은 밝게/종이/어둡게, 그리고 직접 고르기. 바탕이 어두우면 `data-dark`를 붙이고 React Flow도 `colorMode="dark"`. label 상자 색은 `--box-mix`(밝을 때 55%, 어두울 때 20%)만큼 면 색과 섞는다.
- **집중 모드**: `store.focusMode`. `.app.focus`가 툴바·양쪽 패널·미니맵·확대 버튼·안내 글을 숨긴다. 저장하지 않고 새로고침하면 꺼진다. 알림(`say`)은 화면 아래 토스트로 띄워서 집중 모드에서도 보인다.
- **밑줄 커서 (`src/Caret.tsx`)**: 상자 안 편집(`.box.editing`)의 글 입력칸에서 브라우저 커서를 투명하게 하고, 강조색 밑줄을 1.05초 주기로 깜박인다. 입력칸 스타일을 복사한 보이지 않는 div에 커서 앞 글자를 넣어 자리를 재고, 매 프레임 입력칸 위치·확대 비율을 다시 읽어 화면 이동/확대를 따라간다. 커서가 움직이면 켜진 상태부터 다시 깜박인다. 글자를 범위 선택하면 숨기고, 한글 조합 중에는 보인다.
- **단축키**: `ACTIONS`에 동작과 기본 키. 키는 `e.code`(자판 위치)로 적어 한글 입력 상태에서도 같다. Cmd는 Ctrl로 본다. 바꿀 때 Ctrl/Alt 없는 키는 F1~F12만 허용하고, 겹치면 다른 동작의 키를 비운다. 실행 취소/다시 실행은 입력칸 밖에서만(입력칸 안은 브라우저 글자 되돌리기).
- **글꼴**: Pretendard 400/500/600(`default`는 예전 설정과 맞추려고 Pretendard 400의 id)과 Neo둥근모. CSS 변수 `--font`(본문)·`--mono`(코드)·`--font-weight`로 화면 전체를 바꾼다. Pretendard는 `pretendard` 패키지의 가변 글꼴 `PretendardVariable.woff2`(약 2MB, 한글 11,172자, 굵기 45~930) 하나를 `?url`로 가져와 빌드 때 파일 안에 넣고 `FontFace('Pretendard Variable', …, { weight: '45 930' })`로 등록한다. Neo둥근모는 `@kfonts/neodgm`의 woff2(44KB). 각 글꼴은 고르거나 설정 창을 열 때 등록한다. 라이선스는 `licenses/`. 이 글꼴 때문에 `dist/index.html`이 약 4.7MB가 된다. Apple 스타일 테마도 같은 글꼴을 쓴다.
- **상자 진하기** (`boxStrength`, 0~100, 기본 30): CSS `--box-strength`(0~1). 상자 바탕은 (label 색과 면 색을 `--box-mix`로 섞은 색)을 이 비율만큼 바탕 위에 칠하고, 상자 테두리·label 배경·이름표·선택지·연출 코드 바탕도 이 값에 비례한다. label·캐릭터 색은 인라인 `--g`/`--c` 변수로 넘긴다.
- **label 경계선** (`frameWidth`, 1~6px, 기본 3): CSS `--frame-w`. label 묶음 테두리를 실선으로, 색은 label 색 45%와 흐린 글자색을 섞어 옅게 두고 굵기로 보이게 한다. 1비트에서는 같은 굵기의 점선.
- **label 색 입히기** (`labelTint`, 0~100, 기본 50): CSS `--label-tint`. 상자에 섞는 label 색 비율 `--box-mix`(밝은 테마 ×110%, 최대 100%, 어두운 테마 ×40%)와 label 배경 색에 곱한다.
- **Apple 스타일 테마** (`apple`, `apple-color`): `data-look`. 바탕 #f2f2f7, 면 흰색, 강조 #007aff, 회색 #8e8e93. 상자·label 배경·선택지·입력칸의 테두리를 없애고 둥근 모서리(상자 16px, label 24px)와 옅은 그림자, Apple 회색 채움(rgba(118,118,128,.08~.12))으로만 구분한다. 글꼴이 "기본"이면 시스템 글꼴(-apple-system 등)을 먼저 쓴다. `apple-color`는 label·캐릭터 색의 색상(hue)만 따서 `oklch(from 색 0.7 0.16 h)`로 또렷한 색을 만들어 상자·label 배경에 `--label-tint`만큼 입히고, 이름표는 진한 색에 흰 글자. (relative color를 못 쓰는 브라우저는 원래 label 색)
- **상자 색**: 상자에 `color`가 있으면 `--g`에 label 색 대신 그 색을 넘기고 `.own-color`를 붙인다. Apple 컬러풀은 이때 색상만 따는 보정 없이 그 색을 그대로 쓴다. 고르는 곳은 환경 설정의 [상자 색] 하나뿐이다(편집 화면을 깔끔하게 두려고): 대상(모든 상자/선택한 상자/label 하나)과 색(색 고르기 칸과 hex 코드 입력칸. `#RRGGBB`/`#RGB`, `#` 없이 적어도 됨. 틀린 코드는 빨갛게 표시하고 칠할 색은 바꾸지 않는다)을 골라 한꺼번에 칠하거나 label 색으로 되돌린다. `update()`로 바꿔서 실행 취소가 된다. 미니맵도 이 색.
- **1비트 테마** (`onebit` 검정 바탕, `onebit-light` 흰 바탕): `data-mono="1"`. 모든 면을 바탕색으로, 테두리·글자·선·핸들·이름표를 글자색 하나로 그린다(칠하지 않고 외곽선만). 상자 진하기는 쓰지 않는다. 미니맵은 바탕색 상자에 글자색 테두리.
- **집중 모드 흐림**: 집중 모드이고 편집 중인 상자가 있을 때(`.app.focus:has(.box.editing)`), 편집 상자 안에서 포커스가 없는 줄·제목·선택지는 `--dim-line`, 다른 상자·label 배경·선은 `--dim-box` 불투명도. 흐린 상자는 마우스를 올리면 0.6 이상으로. 단계(끄기/약하게/보통/강하게)별 값은 `prefs.ts`의 `DIMS`.
- 환경 설정은 대본이 아니라 브라우저에 붙는 설정이라 `localStorage['pykaki-prefs']`에 둔다(못 쓰면 기본값).

## 9. 저장

| 층 | 방식 | 위치 |
|---|---|---|
| 자동 저장 | 변경 0.7초 뒤 | IndexedDB `renpy-flow-editor` / `kv.current` |
| 버전 스냅샷 | [버전 저장], 열기/새로/복원 직전 자동 | IndexedDB `snapshots` |
| 파일 | Ctrl+S, `.flow.json` | 사용자 폴더 (진짜 백업) |
| `.rpy` | 내보내기, 핸들 기억 → Ctrl+E로 같은 곳 | 게임 `game/` 폴더 권장 |

- 파일로 저장하지 않은 변경이 있으면 탭을 닫을 때 경고한다.
- 사이트와 로컬 `dist/index.html`은 출처(origin)가 달라서 자동 저장 공간이 따로다.

## 9-1. 웹앱 설치 (PWA)

- `public/`의 `manifest.webmanifest`, `sw.js`, 아이콘(Ren'Py 런처 아이콘을 보라색 모노톤으로 바꾼 PNG 32/192/512/마스크용 512, `licenses/RENPY-ICON.txt`)이 빌드 때 `dist/`로 그대로 복사된다. 경로는 모두 상대 경로라 GitHub Pages의 `/pykaki/` 아래에서 동작한다.
- 서비스 워커는 **네트워크 먼저**: 인터넷이 되면 늘 새로 받아 캐시에 넣고, 안 되면 캐시로 연다. 그래서 `main`에 올린 업데이트가 설치한 앱에도 바로 반영된다.
- 등록은 `src/pwa.ts`에서 http/https일 때만 한다(파일로 연 `dist/index.html`에서는 하지 않음). `beforeinstallprompt`를 잡아 두었다가 툴바 [앱 설치]로 띄운다.
- `theme-color`는 화면 색 설정의 바탕색을 따른다.

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
| `src/stage.ts` | 연출 줄 → 렌파이 명령 |
| `src/LineFields.tsx` | 줄 종류 선택, 연출 줄 입력칸, 줄 끌어 옮기기 |
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
| `src/prefs.ts` | 환경 설정(화면 색, 단축키) |
| `src/SettingsModal.tsx` | 환경 설정 창 |
| `src/Caret.tsx` | 상자 안 편집의 밑줄 커서 |
| `src/FlowMenu.tsx` | 편집 중 오른쪽에 붙는 다음 흐름 창 |
| `src/pwa.ts`, `public/` | 웹앱 설치 |
| `licenses/` | 함께 배포하는 글꼴의 라이선스 |

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
- **미검증**: 내보낸 `.rpy`를 실제 렌파이에서 실행해 보지 않았다(특히 로컬 label `label 그룹.id:` 형식).
