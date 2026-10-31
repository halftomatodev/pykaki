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
}

interface F {
  name: string | null; // 연결한 폴더 이름
  media: Media;
  startClash: string | null; // label start가 있는 다른 파일
  set(v: Partial<F>): void;
}

export const useGameFolder = create<F>((set) => ({
  name: null,
  media: { images: [], audio: [] },
  startClash: null,
  set: (v) => set(v),
}));

let dir: any = null;

// 렌파이 그림 이름: 파일 이름에서 확장자를 빼고 소문자로. 안쪽 폴더는 이름에 안 들어간다
export const imageNameOf = (file: string) => file.replace(/\.[^.]+$/, '').toLowerCase().split('@')[0].trim();
// 영상: 앞의 mask_는 투명 영상 표시라서 뺀다
export const movieNameOf = (file: string) => imageNameOf(file).replace(/^mask_/, '');

const IMG = /\.(png|jpe?g|webp|avif)$/i;
const MOV = /\.webm$/i;
const SND = /\.(ogg|opus|mp3|wav|flac)$/i;

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

export async function scanFolder() {
  if (!dir) return;
  const media: Media = { images: [], audio: [] };
  const images = await sub(dir, 'images');
  if (images) for (const f of await walk(images)) if (IMG.test(f)) media.images.push(imageNameOf(f.split('/').pop()!));
  const movies = await sub(dir, 'movies');
  if (movies) for (const f of await walk(movies)) if (MOV.test(f)) media.images.push(movieNameOf(f.split('/').pop()!));
  const audio = await sub(dir, 'audio');
  if (audio) for (const f of await walk(audio)) if (SND.test(f)) media.audio.push(f);
  media.images = [...new Set(media.images)].sort();
  media.audio.sort();

  // 새 렌파이 프로젝트의 script.rpy에도 label start가 있어서 두 번 정의가 된다
  let startClash: string | null = null;
  for await (const [name, h] of dir.entries()) {
    if (h.kind !== 'file' || !/\.rpy$/i.test(name) || name === RPY_FILE) continue;
    if (/^label\s+start\s*(\(|:)/m.test(await (await h.getFile()).text())) {
      startClash = name;
      break;
    }
  }
  useGameFolder.getState().set({ name: dir.name, media, startClash });
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
    await pullInbox();
    useStore.getState().say(`렌파이 폴더 "${dir.name}"를 연결했어요`);
    return true;
  } catch (e: any) {
    if (e?.name !== 'AbortError') alert('폴더를 연결하지 못했어요: ' + e.message);
    return false;
  }
}

export async function disconnectFolder() {
  dir = null;
  await kvSet('gameDir', null);
  useGameFolder.getState().set({ name: null, media: { images: [], audio: [] }, startClash: null });
}

// 앱을 다시 열 때: 연결은 기억하지만, 권한은 사용자가 한 번 눌러야 다시 생긴다
export async function restoreFolder() {
  if (!hasDirPicker) return;
  try {
    dir = (await kvGet('gameDir')) ?? null;
    if (!dir) return;
    useGameFolder.getState().set({ name: dir.name });
    if (await allowed(false)) await scanFolder();
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
  s.say(`showpy에서 넣은 줄 ${res.applied}개를 받아 적었어요${extra ? ' (' + extra + ')' : ''}`);
  return res.applied;
}

export async function writeRpyToFolder(code: string) {
  await writeText(dir, RPY_FILE, code);
}

export { allowed as folderAllowed };
