// 연출 줄(scene/show/hide/music/sound): 칸에 적은 값 → 렌파이 명령 한 줄
import type { Line, LineType } from './types';

export const STAGE_TYPES: LineType[] = ['scene', 'show', 'hide', 'music', 'sound'];
export const isStage = (t: LineType) => STAGE_TYPES.includes(t);

// 줄 종류 칸이 좁아서 짧게. 실제 명령은 칸 아래에 따로 보여 준다
export const STAGE_LABEL: Record<string, string> = {
  scene: '🖼 배경',
  show: '🧍 보이기',
  hide: '🙈 숨기기',
  music: '🎵 음악',
  sound: '🔊 효과음',
};

export const TRANSITIONS: [string, string][] = [['', '바로'], ['dissolve', '서서히'], ['fade', '검게 페이드']];
export const POSITIONS: [string, string][] = [['', '가운데'], ['left', '왼쪽'], ['right', '오른쪽']];

// 이미지 이름 한 칸: 공백 정리
const words = (s?: string) => (s ?? '').trim().replace(/\s+/g, ' ');
const pyStr = (s: string) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
// 파일 이름만 적으면 game/audio 폴더에서 찾는다
const audioPath = (f: string) => (f.includes('/') ? f : 'audio/' + f);

function imageName(l: Line) {
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
  }
  return { code: null, problem: null };
}

// 렌파이 이미지 이름에 쓰면 탈이 나기 쉬운 글자(한글, 공백 외 기호)
export function badImageName(l: Line) {
  if (l.type !== 'scene' && l.type !== 'show' && l.type !== 'hide') return false;
  if (l.type !== 'scene' && (l.kind ?? 'char') === 'char') return l.type === 'show' && !!l.attr && !/^[A-Za-z0-9_ -]*$/.test(l.attr.trim());
  return !/^[A-Za-z0-9_ -]*$/.test(l.image?.trim() ?? '');
}
