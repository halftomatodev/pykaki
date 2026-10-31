// 프로젝트 저장 파일(JSON)의 구조. 설계 문서 5장 참고.

// scene/show/hide/music/sound는 렌파이 명령을 몰라도 칸만 채우면 되는 연출 줄
export type LineType = 'narration' | 'say' | 'scene' | 'show' | 'hide' | 'music' | 'sound' | 'fx' | 'command' | 'note';

// showpy 화면 효과 값. 대사 줄은 괄호로, 연출 줄(fx)은 명령으로 내보낸다. 빈 칸은 안 내보낸다
export interface LineFx {
  fx?: string; // ascii | retro_term | gameboy | none | default
  transition?: string; // tv | fade | none
  overlay?: string; // on | off
  warp?: string; // 0~5 | default
  cursor?: string; // effect | overlay | top | default
}

export type ImageKind = 'char' | 'bg' | 'etc';

export interface Line {
  id: string;
  type: LineType;
  who?: string; // say, 캐릭터 show/hide일 때 캐릭터 id
  attr?: string; // say, 캐릭터 show일 때 이미지 속성(표정 등)
  text: string; // 연출 줄에서는 쓰지 않는다
  kind?: ImageKind; // show/hide: 이미지 종류
  image?: string; // scene/배경: bg 뒤 이름, 기타: 이미지 이름
  at?: string; // show: left | right (비우면 가운데)
  trans?: string; // scene/show/hide: dissolve | fade (비우면 바로)
  file?: string; // music/sound: 파일 이름
  stop?: boolean; // music: 멈추기
  fx?: LineFx; // say, narration, fx 줄 (showpy 연결을 켰을 때만 내보낸다)
}

export interface Choice {
  id: string;
  text: string;
  target: string | null;
  mode: 'jump';
  condition: string | null; // 2단계(플래그)용, 지금은 null
  actions: string[]; // 2단계(플래그)용, 지금은 비어 있음
}

export type Exit =
  | { type: 'next'; target: string | null }
  | { type: 'menu'; choices: Choice[] }
  | { type: 'call'; target: string | null; then: string | null }
  | { type: 'return' };

export type ExitType = Exit['type'];

export interface BoxNode {
  id: string;
  group: string; // LabelGroup.id
  color?: string; // 상자 색. 없으면 label 색을 따른다
  title: string;
  pos: { x: number; y: number };
  lines: Line[];
  exit: Exit;
}

export interface Character {
  id: string; // 렌파이 변수 이름
  name: string;
  color: string;
}

export interface LabelGroup {
  id: string;
  name: string; // 렌파이 label 이름
  title: string; // 화면 표시용
  color: string;
  entry: string | null;
}

export interface Settings {
  escapeBrackets: boolean; // [ → [[
  allowTextTags: boolean; // false면 { → {{
  escapePercent: boolean; // % → %%
  renpyLink: boolean; // showpy 연결: 상자마다 label, 줄 표시, 플러그인 문법을 내보낸다
}

export interface Project {
  format: 'renpy-flow';
  version: 1;
  project: { title: string; startNode: string | null };
  characters: Character[];
  variables: unknown[];
  labels: LabelGroup[];
  layout: { direction: 'TB' | 'LR' };
  settings: Settings;
  nodes: BoxNode[];
}
