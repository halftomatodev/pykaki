// 프로젝트 저장 파일(JSON)의 구조. 설계 문서 5장 참고.

export type LineType = 'narration' | 'say' | 'command' | 'note';

export interface Line {
  id: string;
  type: LineType;
  who?: string; // say일 때 캐릭터 id
  attr?: string; // say일 때 이미지 속성(표정 등)
  text: string;
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
