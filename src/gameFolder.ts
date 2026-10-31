// 렌파이 game 폴더 연결: 그림/소리 목록, script_flow.rpy 쓰기, showpy_inbox.json 받아 적기.
// 크롬·엣지의 폴더 권한을 쓴다. 다른 브라우저에서는 연결 없이 지금처럼 글자로 적는다.
import { create } from 'zustand';
import { kvGet, kvSet, snapAdd } from './persist';
import { applyInbox, type InboxOp } from './inbox';
import { useStore } from './store';

const w = window as any;
export const hasDirPicker = typeof w.showDirectoryPicker === 'function';
export const INBOX_FILE = 'showpy_inbox.json';
export const RPY_FILE = 'script_flow.rpy';

export interface Media {
  images: string[]; // "bg hall", "mina scared", "ghost", 영상도 같은 이름 규칙
  audio: string[]; // audio 폴더 기준 경로
  fonts: string[]; // game 폴더 기준 경로
}

// 플레이 화면을 게임처럼 그리는 데 쓰는 값. gui.rpy 등에서 읽고, 없으면 렌파이 기본값 (1280x720)
export interface GameLook {
  width: number;
  height: number;
  textSize: number;
  nameSize: number;
  textColor: string;
  font: string | null;
  textboxHeight: number;
  textboxYalign: number;
  nameX: number;
  nameY: number;
  dialogueX: number;
  dialogueY: number;
  dialogueWidth: number;
  textCps: number; // 0이면 한 번에
  textbox: string | null; // gui/textbox.png
  namebox: string | null; // gui/namebox.png
  placed: Record<string, [number, number]>; // stage_layout.rpy. "태그" 또는 "상자|태그"
}

export const DEFAULT_LOOK: GameLook = {
  width: 1280, height: 720, textSize: 22, nameSize: 30, textColor: '#ffffff', font: null,
  textboxHeight: 185, textboxYalign: 1, nameX: 240, nameY: 0, dialogueX: 268, dialogueY: 50, dialogueWidth: 744,
  textCps: 0, textbox: null, namebox: null, placed: {},
};

interface F {
  name: string | null; // 연결한 폴더 이름
  media: Media;
  look: GameLook;
  startClash: string | null; // label start가 있는 다른 파일
  hasShowpy: boolean; // game 폴더에 ui_kit이 있는지
  set(v: Partial<F>): void;
}

const NO_MEDIA: Media = { images: [], audio: [], fonts: [] };

export const useGameFolder = create<F>((set) => ({
  name: null,
  media: NO_MEDIA,
  look: DEFAULT_LOOK,
  startClash: null,
  hasShowpy: false,
  set: (v) => set(v),
}));

let dir: any = null;
let pictures = new Map<string, { path: string; video: boolean }>(); // 렌파이 그림 이름 → game 폴더 기준 경로
const urls = new Map<string, string>(); // 경로 → 읽어 둔 주소

// 렌파이 그림 이름: 파일 이름에서 확장자를 빼고 소문자로. 안쪽 폴더는 이름에 안 들어간다
export const imageNameOf = (file: string) => file.replace(/\.[^.]+$/, '').toLowerCase().split('@')[0].trim();
// 영상: 앞의 mask_는 투명 영상 표시라서 뺀다
export const movieNameOf = (file: string) => imageNameOf(file).replace(/^mask_/, '');

const IMG = /\.(png|jpe?g|webp|avif)$/i;
const MOV = /\.webm$/i;
const SND = /\.(ogg|opus|mp3|wav|flac)$/i;
const FONT = /\.(ttf|otf|ttc|woff2?)$/i;

async function walk(d: any, prefix = ''): Promise<string[]> {
  const out: string[] = [];
  for await (const [name, h] of d.entries()) {
    if (h.kind === 'directory') out.push(...(await walk(h, prefix + name + '/')));
    else out.push(prefix + name);
  }
  return out;
}

async function sub(d: any, name: string) {
  try {
    return await d.getDirectoryHandle(name);
  } catch {
    return null;
  }
}

async function readText(d: any, name: string): Promise<string | null> {
  try {
    return await (await (await d.getFileHandle(name)).getFile()).text();
  } catch {
    return null;
  }
}

async function writeText(d: any, name: string, text: string) {
  const ws = await (await d.getFileHandle(name, { create: true })).createWritable();
  await ws.write(text);
  await ws.close();
}

// game 폴더 기준 경로의 파일을 브라우저 주소로. 없으면 null
export async function fileUrl(path: string): Promise<string | null> {
  if (!dir) return null;
  const had = urls.get(path);
  if (had) return had;
  try {
    let d = dir;
    const parts = path.split('/').filter(Boolean);
    for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p);
    const url = URL.createObjectURL(await (await d.getFileHandle(parts[parts.length - 1])).getFile());
    urls.set(path, url);
    return url;
  } catch {
    return null;
  }
}

export async function pictureOf(name: string) {
  const p = pictures.get(name);
  if (!p) return null;
  const url = await fileUrl(p.path);
  return url ? { url, video: p.video } : null;
}

// 대본의 소리 파일 이름은 audio 폴더 기준일 수도, game 폴더 기준일 수도 있다
export const soundUrl = async (file: string) => (await fileUrl(file)) ?? (await fileUrl('audio/' + file));

// 게임 글꼴을 브라우저에 등록하고 글꼴 이름을 돌려준다. 다 읽기 전에는 다음 글꼴로 보인다
const families = new Map<string, string>();
let familySeq = 0; // 폴더를 다시 읽어도 이름이 겹치지 않게 계속 센다
export function gameFont(path: string | null | undefined) {
  if (!path || !dir) return undefined;
  let name = families.get(path);
  if (!name) {
    name = 'pk-game-' + familySeq++;
    families.set(path, name);
    const family = name;
    void fileUrl(path)
      .then(async (u) => {
        if (!u) return;
        const ff = new FontFace(family, `url(${u})`);
        document.fonts.add(await ff.load());
      })
      .catch((e) => console.warn('글꼴을 못 읽었어요', path, e));
  }
  return name;
}

const num = (src: string, key: string, def: number) => {
  const m = new RegExp(`^define\\s+gui\\.${key}\\s*=\\s*(-?[\\d.]+)`, 'm').exec(src);
  return m ? Number(m[1]) : def;
};
const quoted = (src: string, key: string) => new RegExp(`^define\\s+gui\\.${key}\\s*=\\s*"([^"]+)"`, 'm').exec(src)?.[1] ?? null;

// 게임의 설정 파일을 읽는다. 게임 안의 코드는 실행하지 않고 값만 찾는다
async function readLook(): Promise<GameLook> {
  const d = DEFAULT_LOOK;
  const gui = (await readText(dir, 'gui.rpy')) ?? '';
  const size = /gui\.init\(\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(gui);
  const options = (await readText(dir, 'options.rpy')) ?? '';
  const uiKit = await sub(dir, 'ui_kit');
  const uiConfig = uiKit ? (await readText(uiKit, 'custom_ui_config.rpy')) ?? '' : '';
  const layout = uiKit ? (await readText(uiKit, 'stage_layout.rpy')) ?? '' : '';
  const cps = /^define\s+custom_ui\.text_cps\s*=\s*(\d+)/m.exec(uiConfig) ?? /^default\s+preferences\.text_cps\s*=\s*(\d+)/m.exec(options);

  const placed: GameLook['placed'] = {};
  for (const m of layout.matchAll(/(?:"(\w+)"|\(\s*"([^"]+)"\s*,\s*"(\w+)"\s*\))\s*:\s*"stage\.pos\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)/g))
    placed[m[1] ?? m[2] + '|' + m[3]] = [Number(m[4]), Number(m[5])];

  return {
    width: size ? Number(size[1]) : d.width,
    height: size ? Number(size[2]) : d.height,
    textSize: num(gui, 'text_size', d.textSize),
    nameSize: num(gui, 'name_text_size', d.nameSize),
    textColor: quoted(gui, 'text_color') ?? d.textColor,
    font: quoted(gui, 'text_font'),
    textboxHeight: num(gui, 'textbox_height', d.textboxHeight),
    textboxYalign: num(gui, 'textbox_yalign', d.textboxYalign),
    nameX: num(gui, 'name_xpos', d.nameX),
    nameY: num(gui, 'name_ypos', d.nameY),
    dialogueX: num(gui, 'dialogue_xpos', d.dialogueX),
    dialogueY: num(gui, 'dialogue_ypos', d.dialogueY),
    dialogueWidth: num(gui, 'dialogue_width', d.dialogueWidth),
    textCps: cps ? Number(cps[1]) : d.textCps,
    textbox: await fileUrl('gui/textbox.png'),
    namebox: await fileUrl('gui/namebox.png'),
    placed,
  };
}

export async function scanFolder() {
  if (!dir) return;
  // 그림을 바꾸고 돌아와도 새 파일이 보이게 다시 읽는다. 옛 주소는 화면이 새 값을 받은 뒤에 버린다
  const oldUrls = [...urls.values()];
  urls.clear();
  families.clear();
  const media: Media = { images: [], audio: [], fonts: [] };
  const found = new Map<string, { path: string; video: boolean }>();
  const images = await sub(dir, 'images');
  if (images) for (const f of await walk(images)) if (IMG.test(f)) found.set(imageNameOf(f.split('/').pop()!), { path: 'images/' + f, video: false });
  const movies = await sub(dir, 'movies');
  if (movies) for (const f of await walk(movies)) if (MOV.test(f)) found.set(movieNameOf(f.split('/').pop()!), { path: 'movies/' + f, video: true });
  pictures = found;
  media.images = [...found.keys()].sort();
  const audio = await sub(dir, 'audio');
  if (audio) for (const f of await walk(audio)) if (SND.test(f)) media.audio.push(f);
  media.audio.sort();
  for await (const [name, h] of dir.entries()) if (h.kind === 'file' && FONT.test(name)) media.fonts.push(name);
  const fonts = await sub(dir, 'fonts');
  if (fonts) for (const f of await walk(fonts)) if (FONT.test(f)) media.fonts.push('fonts/' + f);
  media.fonts.sort();
  const look = await readLook();

  // 대본에 이름이 start인 label을 만들면 script.rpy의 label start와 겹친다
  let startClash: string | null = null;
  for await (const [name, h] of dir.entries()) {
    if (h.kind !== 'file' || !/\.rpy$/i.test(name) || name === RPY_FILE) continue;
    if (/^label\s+start\s*(\(|:)/m.test(await (await h.getFile()).text())) {
      startClash = name;
      break;
    }
  }
  const hasShowpy = !!(await sub(dir, 'ui_kit'));
  useGameFolder.getState().set({ name: useGameFolder.getState().name ?? dir.name, media, look, startClash, hasShowpy });
  setTimeout(() => oldUrls.forEach((u) => URL.revokeObjectURL(u)), 5000);
}

const allowed = async (ask: boolean) => {
  if (!dir) return false;
  const o = { mode: 'readwrite' };
  if ((await dir.queryPermission(o)) === 'granted') return true;
  return ask ? (await dir.requestPermission(o)) === 'granted' : false;
};

// 고른 폴더가 프로젝트 폴더면 그 안의 game을 쓴다
export async function connectFolder() {
  try {
    const picked = await w.showDirectoryPicker({ id: 'pykaki-game', mode: 'readwrite' });
    const inner = await sub(picked, 'game');
    dir = inner ?? picked;
    await kvSet('gameDir', dir);
    await scanFolder();
    await kvSet('gameName', inner ? picked.name : dir.name);
    useGameFolder.getState().set({ name: inner ? picked.name : dir.name });
    await pullInbox();
    useStore.getState().say(`렌파이 폴더 "${useGameFolder.getState().name}"를 연결했어요`);
    return true;
  } catch (e: any) {
    if (e?.name !== 'AbortError') alert('폴더를 연결하지 못했어요: ' + e.message);
    return false;
  }
}

export async function disconnectFolder() {
  dir = null;
  await kvSet('gameDir', null);
  pictures = new Map();
  useGameFolder.getState().set({ name: null, media: NO_MEDIA, look: DEFAULT_LOOK, startClash: null, hasShowpy: false });
}

// 앱을 다시 열 때: 연결은 기억하지만, 권한은 사용자가 한 번 눌러야 다시 생긴다
export async function restoreFolder() {
  if (!hasDirPicker) return;
  try {
    dir = (await kvGet('gameDir')) ?? null;
    if (!dir) return;
    const name = (await kvGet('gameName')) ?? dir.name;
    useGameFolder.getState().set({ name });
    if (await allowed(false)) await scanFolder();
    useGameFolder.getState().set({ name });
  } catch {
    dir = null;
  }
}

export const folderReady = () => !!dir;

// 받아 적기. 받은 것이 있으면 저장본을 먼저 남기고, 다 적은 기록은 파일에서 지운다
export async function pullInbox(ask = false) {
  if (!(await allowed(ask))) return 0;
  const text = await readText(dir, INBOX_FILE);
  if (!text) return 0;
  let ops: InboxOp[] = [];
  try {
    ops = JSON.parse(text).ops ?? [];
  } catch {
    return 0; // showpy가 쓰는 중이면 다음에 다시 읽는다
  }
  if (!ops.length) return 0;
  const s = useStore.getState();
  await snapAdd('받아 적기 전 자동 백업', s.project).catch(() => {});
  let res = { applied: 0, moved: [] as string[], dropped: [] as string[] };
  s.update((p) => void (res = applyInbox(p, ops)));

  // 읽는 동안 showpy가 더 적었으면 그 기록은 남긴다
  const done = new Set(ops.map((o) => o.id));
  let rest: InboxOp[] = [];
  try {
    rest = (JSON.parse((await readText(dir, INBOX_FILE)) ?? '{}').ops ?? []).filter((o: InboxOp) => !done.has(o.id));
  } catch {
    /* 비운다 */
  }
  await writeText(dir, INBOX_FILE, JSON.stringify({ format: 'showpy-inbox', version: 1, ops: rest }, null, 2));

  const extra = [res.moved.length ? `기준 줄이 없어 상자 끝에 넣음 ${res.moved.length}개` : '', res.dropped.length ? `넣을 곳이 없어 뺌: ${res.dropped.join(', ')}` : ''].filter(Boolean).join(' / ');
  s.say(`showpy에서 고친 ${res.applied}곳을 받아 적었어요${extra ? ' (' + extra + ')' : ''}`);
  return res.applied;
}

// 고른 폴더가 렌파이 프로젝트인지. 새 프로젝트에는 늘 gui.rpy나 options.rpy가 있다
export const looksLikeGame = async () => (await readText(dir, 'gui.rpy')) !== null || (await readText(dir, 'options.rpy')) !== null;
export const readRpyFromFolder = () => readText(dir, RPY_FILE);

export async function writeRpyToFolder(code: string) {
  await writeText(dir, RPY_FILE, code);
}

export { allowed as folderAllowed };
