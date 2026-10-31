// 연출 줄(scene/show/hide/music/sound): 칸에 적은 값 → 렌파이 명령 한 줄
import type { Line, LineFx, LineType, SayStyle } from './types';

export const STAGE_TYPES: LineType[] = ['scene', 'show', 'hide', 'music', 'sound', 'fx'];
export const isStage = (t: LineType) => STAGE_TYPES.includes(t);

// 줄 종류 칸이 좁아서 짧게. 실제 명령은 칸 아래에 따로 보여 준다
export const STAGE_LABEL: Record<string, string> = {
  scene: '🖼 배경',
  show: '🧍 보이기',
  hide: '🙈 숨기기',
  music: '🎵 음악',
  sound: '🔊 효과음',
  fx: '✨ 화면 효과',
};

export const TRANSITIONS: [string, string][] = [['', '바로'], ['dissolve', '서서히'], ['fade', '검게 페이드']];
export const POSITIONS: [string, string][] = [['', '가운데'], ['left', '왼쪽'], ['right', '오른쪽']];

// showpy 화면 효과 칸의 값들
export const FX_BASE: [string, string][] = [['', '그대로'], ['ascii', 'ASCII'], ['retro_term', '레트로 터미널'], ['gameboy', '게임보이'], ['none', '효과 없음'], ['default', '기본으로']];
export const FX_TRANS: [string, string][] = [['', '전환 기본'], ['tv', 'TV'], ['fade', '페이드'], ['none', '바로']];
export const FX_OVERLAY: [string, string][] = [['', '덮개 기본'], ['on', '덮개 켬'], ['off', '덮개 끔']];
export const FX_WARP: [string, string][] = [['', '휘어짐 그대로'], ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['default', '기본값']];
export const FX_CURSOR: [string, string][] = [['', '커서 그대로'], ['effect', '효과 받음'], ['overlay', '덮개 밑'], ['top', '효과 안 받음'], ['default', '기본으로']];

const warpVal = (v: string) => (v === 'default' ? '"default"' : v);

// 대사 줄의 괄호 안 값: fx="ascii", fx_warp=3 ...
export function fxArgs(f?: LineFx): string[] {
  if (!f) return [];
  const a: string[] = [];
  if (f.fx) a.push(`fx=${pyStr(f.fx)}`);
  if (f.transition) a.push(`fx_transition=${f.transition === 'none' ? 'None' : pyStr(f.transition)}`);
  if (f.overlay) a.push(`fx_overlay=${f.overlay === 'on' ? 'True' : 'False'}`);
  if (f.warp) a.push(`fx_warp=${warpVal(f.warp)}`);
  if (f.cursor) a.push(`fx_cursor=${pyStr(f.cursor)}`);
  if (f.exclude) a.push(`fx_exclude=(${f.exclude.map((g) => pyStr(g) + ',').join(' ')})`);
  return a;
}

// 대사 등장 효과 (렌파이 내장 텍스트 셰이더)
export const EFFECTS: [string, string][] = [['', '효과 없음'], ['dissolve', '서서히'], ['typewriter', '타자기'], ['slowalpha', '흐리게 대기'], ['flip', '뒤집히며'], ['zoom', '커지며'], ['jitter', '떨림'], ['wave', '물결']];

// showpy가 없는 게임에서는 렌파이 원래 이름으로 내보낸다. 그러면 플러그인 없이도 오류가 나지 않는다
const NATIVE: Record<keyof SayStyle, string> = {
  size: 'what_size', font: 'what_font', color: 'what_color', cps: 'what_slow_cps', effect: 'what_textshader',
  name_size: 'who_size', name_font: 'who_font', name_color: 'who_color',
  x: 'what_xpos', y: 'what_ypos', name_x: 'namebox_xpos', name_y: 'namebox_ypos',
};

// 대사 줄의 괄호 안 값: size=30, cps=20 ... 위치는 showpy가 뒤에 덧붙이는 순서와 맞춰 맨 뒤에 둔다
export function sayArgs(s?: SayStyle, native = false): string[] {
  if (!s) return [];
  const a: string[] = [];
  const name = (k: keyof SayStyle) => (native ? NATIVE[k] : k);
  const num = (k: keyof SayStyle) => s[k] !== undefined && a.push(`${name(k)}=${s[k]}`);
  const str = (k: keyof SayStyle) => s[k] && a.push(`${name(k)}=${pyStr(String(s[k]))}`);
  num('size');
  str('font');
  str('color');
  num('cps');
  str('effect');
  num('name_size');
  str('name_font');
  str('name_color');
  num('x');
  num('y');
  num('name_x');
  num('name_y');
  return a;
}

// 화면 효과 연출 줄의 명령. 줄이 여러 개면 \n으로 잇는다
function fxCode(f?: LineFx): string | null {
  if (!f) return null;
  const out: string[] = [];
  if (f.fx) {
    const opt: string[] = [];
    if (f.overlay) opt.push(`overlay=${f.overlay === 'on' ? 'True' : 'False'}`);
    if (f.transition) opt.push(`transition=${f.transition === 'none' ? 'None' : pyStr(f.transition)}`);
    if (f.cursor) opt.push(`cursor=${pyStr(f.cursor)}`);
    const tail = opt.join(', ');
    out.push(f.fx === 'default' ? `$ screen_fx.clear(${tail})` : `$ screen_fx.use(${[pyStr(f.fx), tail].filter(Boolean).join(', ')})`);
  } else {
    if (f.overlay) out.push(`$ screen_fx.set_overlay(${f.overlay === 'on' ? 'True' : 'False'})`);
    if (f.cursor) out.push(`$ screen_fx.set_cursor(${pyStr(f.cursor)})`);
  }
  if (f.warp) out.push(`$ screen_fx.set_warp(${warpVal(f.warp)})`);
  return out.length ? out.join('\n') : null;
}

// 이미지 이름 한 칸: 공백 정리
const words = (s?: string) => (s ?? '').trim().replace(/\s+/g, ' ');
const pyStr = (s: string) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
// 파일 이름만 적으면 game/audio 폴더에서 찾는다
const audioPath = (f: string) => (f.includes('/') ? f : 'audio/' + f);

export function imageName(l: Line) {
  const k = l.kind ?? 'char';
  if (k === 'bg') return words(l.image) ? 'bg ' + words(l.image) : '';
  if (k === 'char') return l.who ? [l.who, words(l.attr)].filter(Boolean).join(' ') : '';
  return words(l.image);
}

// code가 null이면 칸이 덜 채워진 것이고, problem에 이유가 있다
export function stageCode(l: Line): { code: string | null; problem: string | null } {
  const w = l.trans ? ` with ${l.trans}` : '';
  const need = (what: string) => ({ code: null, problem: what });
  switch (l.type) {
    case 'scene': {
      const n = words(l.image);
      return { code: `scene${n ? ' bg ' + n : ''}${w}`, problem: null };
    }
    case 'show': {
      const n = imageName(l);
      if (!n) return need(l.kind === 'char' || !l.kind ? '보일 캐릭터를 골라 주세요' : '보일 이미지 이름을 적어 주세요');
      return { code: `show ${n}${l.at ? ' at ' + l.at : ''}${w}`, problem: null };
    }
    case 'hide': {
      const k = l.kind ?? 'char';
      const tag = k === 'bg' ? 'bg' : k === 'char' ? l.who : words(l.image).split(' ')[0];
      if (!tag) return need(k === 'char' ? '숨길 캐릭터를 골라 주세요' : '숨길 이미지 이름을 적어 주세요');
      return { code: `hide ${tag}${w}`, problem: null };
    }
    case 'music':
      if (l.stop) return { code: 'stop music fadeout 1.0', problem: null };
      if (!l.file?.trim()) return need('음악 파일 이름을 적어 주세요');
      return { code: `play music ${pyStr(audioPath(l.file.trim()))}`, problem: null };
    case 'sound':
      if (!l.file?.trim()) return need('효과음 파일 이름을 적어 주세요');
      return { code: `play sound ${pyStr(audioPath(l.file.trim()))}`, problem: null };
    case 'fx': {
      const c = fxCode(l.fx);
      return c ? { code: c, problem: null } : need('바꿀 값을 골라 주세요');
    }
  }
  return { code: null, problem: null };
}

// 렌파이 이미지 이름에 쓰면 탈이 나기 쉬운 글자(한글, 공백 외 기호)
export function badImageName(l: Line) {
  if (l.type !== 'scene' && l.type !== 'show' && l.type !== 'hide') return false;
  if (l.type !== 'scene' && (l.kind ?? 'char') === 'char') return l.type === 'show' && !!l.attr && !/^[A-Za-z0-9_ -]*$/.test(l.attr.trim());
  return !/^[A-Za-z0-9_ -]*$/.test(l.image?.trim() ?? '');
}
