// 플레이 화면: 게임 해상도 그대로 그린 뒤 창 크기에 맞춰 줄인다. 값은 연결한 game 폴더(gui.rpy 등)에서 읽는다
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Line } from './types';
import type { PStage, Sprite } from './playEngine';
import { transInfo } from './playEngine';
import { lineCps } from './stage';
import { parseTagged, type Tagged } from './textTags';
import { gameFont, pictureOf, useGameFolder, type GameLook } from './gameFolder';

// 줄마다 고른 글꼴. 못 읽으면 게임 기본 글꼴로 보인다
const fontStack = (path?: string) => {
  const f = gameFont(path);
  return f ? `${f}, var(--game-font)` : undefined;
};

// 게임 화면 크기를 창에 맞추는 틀
export function GameFrame({ look, full, onClick, children, top }: { look: GameLook; full: boolean; onClick?: () => void; children: ReactNode; top?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const s = box.w && box.h ? Math.min(box.w / look.width, box.h / look.height) : 0;
  return (
    <div
      ref={ref}
      className={'pframe' + (full ? ' full' : '')}
      style={full ? undefined : { aspectRatio: `${look.width} / ${look.height}` }}
      onClick={onClick}
    >
      <div
        className="game"
        style={{
          width: look.width,
          height: look.height,
          '--game-font': `${gameFont(look.font) ?? 'var(--font)'}, var(--font)`,
          transform: `translate(${(box.w - look.width * s) / 2}px, ${(box.h - look.height * s) / 2}px) scale(${s})`,
        } as React.CSSProperties}
      >
        {children}
      </div>
      {top}
    </div>
  );
}

function usePicture(name: string) {
  const media = useGameFolder((s) => s.media); // 폴더를 다시 읽으면 다시 찾는다
  const [pic, setPic] = useState<{ url: string; video: boolean } | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    pictureOf(name).then((p) => alive && setPic(p));
    return () => void (alive = false);
  }, [name, media]);
  return pic;
}

// 그림의 자리. 정하는 순서: 원고의 at → (상자, 태그) → (태그) → 가운데
function placeOf(s: Sprite, look: GameLook): React.CSSProperties {
  const pos = s.pos ?? look.placed[s.box + '|' + s.tag] ?? look.placed[s.tag];
  if (s.at === 'left') return { left: 0, bottom: 0 };
  if (s.at === 'right') return { right: 0, bottom: 0 };
  if (pos) return { left: pos[0], top: pos[1], translate: '-50% -100%' };
  return { left: look.width / 2, bottom: 0, translate: '-50% 0' };
}

function Layer({ s, look, bg, leaving }: { s: Sprite; look: GameLook; bg?: boolean; leaving?: boolean }) {
  const pic = usePicture(s.name);
  const info = transInfo(s.trans);
  const style: React.CSSProperties = bg ? { left: 0, top: 0 } : placeOf(s, look);
  const anim = info ? ` ${leaving ? 'tout' : 'tin'}-${info.kind}` : '';
  const vars = info ? ({ '--dur': info.dur + 's' } as React.CSSProperties) : undefined;
  if (pic === undefined) return null;
  return (
    <div className={'layer' + anim} style={{ ...style, ...vars }}>
      {!pic ? (
        <span className={'noimg' + (bg ? ' bg' : '')}>{s.name}</span>
      ) : pic.video ? (
        <video src={pic.url} autoPlay loop muted playsInline />
      ) : (
        <img src={pic.url} alt={s.name} draggable={false} />
      )}
    </div>
  );
}

export function Scene({ stage, look }: { stage: PStage; look: GameLook }) {
  const leavingBg = stage.leaving.filter((s) => s.tag === 'bg');
  const leavingOther = stage.leaving.filter((s) => s.tag !== 'bg');
  return (
    <>
      {leavingBg.map((s) => <Layer key={s.key} s={s} look={look} bg leaving />)}
      {stage.bg && <Layer key={stage.bg.key} s={stage.bg} look={look} bg />}
      {leavingOther.map((s) => <Layer key={s.key} s={s} look={look} leaving />)}
      {stage.sprites.map((s) => <Layer key={s.key} s={s} look={look} />)}
      {stage.fade && <div key={stage.fade} className="fade-black" />}
    </>
  );
}

export interface SayBoxHandle { click(): boolean } // 아직 다 안 나왔으면 다 보여 주고 true

// 글자를 속도(글자/초)와 멈춤 태그에 맞춰 하나씩 내보낸다. 대사창과 미리보기가 함께 쓴다
function useReveal(parsed: Tagged, cps: number, wait = 0) {
  const total = parsed.glyphs.length;
  const anyRate = cps > 0 || parsed.glyphs.some((g) => g.fixed && g.rate > 0);
  const [passed, setPassed] = useState(0); // 지나온 멈춤 수
  const stop = parsed.stops[passed];
  const limit = stop ? stop.at : total; // 지금 나올 수 있는 데까지
  const [shown, setShown] = useState(() => (anyRate ? parsed.fastTo : Math.max(parsed.fastTo, parsed.stops[0]?.at ?? total)));
  const [holding, setHolding] = useState(wait > 0);
  const done = shown >= total && !stop;

  // 앞 줄의 전환이 끝날 때까지 글자를 기다린다
  useEffect(() => {
    if (!holding) return;
    const t = setTimeout(() => setHolding(false), wait * 1000);
    return () => clearTimeout(t);
  }, [holding, wait]);

  useEffect(() => {
    if (holding || done) return;
    if (shown >= limit) {
      // {w=1.0}은 기다렸다 넘어가고, {w}는 클릭을 기다린다
      if (stop?.sec == null) return;
      const t = setTimeout(() => setPassed((v) => v + 1), stop.sec * 1000);
      return () => clearTimeout(t);
    }
    const g = parsed.glyphs[shown];
    const rate = g.fixed ? g.rate : cps * g.rate;
    if (rate <= 0) return setShown(limit);
    const t = setTimeout(() => setShown((v) => v + 1), 1000 / rate);
    return () => clearTimeout(t);
  }, [shown, limit, holding, done, cps]);

  // 아직 다 안 나왔으면 다 보여 주고 true
  const click = () => {
    if (holding) return setHolding(false), true;
    if (shown < limit) return setShown(limit), true;
    if (stop) return setPassed((v) => v + 1), true;
    return false;
  };
  return { shown: holding ? 0 : shown, done, click };
}

function Glyphs({ parsed, shown }: { parsed: Tagged; shown: number }) {
  return (
    <>
      {parsed.glyphs.map((g, i) =>
        g.ch === '\n' ? (
          <br key={i} />
        ) : (
          <span key={i} className={'ch' + (i < shown ? ' on' : '')} style={{ ...g.style, '--i': i } as React.CSSProperties}>{g.ch}</span>
        ),
      )}
    </>
  );
}

// 설정 카드의 미리보기: 렌파이를 켜지 않고 이 줄의 글자 효과를 본다. 글자는 칸에 꽉 차게 맞춘다
export function LinePreview({ line, tagsOn }: { line: Line; tagsOn: boolean }) {
  const look = useGameFolder((s) => s.look);
  const [replay, setReplay] = useState(0);
  const cps = lineCps(line.say) ?? look.textCps;
  // 값을 바꾸면 처음부터 다시 나온다
  return <PreviewBody key={[line.id, line.say?.effect, cps, replay].join('|')} line={line} tagsOn={tagsOn} cps={cps} look={look} onReplay={() => setReplay((v) => v + 1)} />;
}

const PREVIEW_MIN = 11;
const PREVIEW_MAX = 60;

function PreviewBody({ line, tagsOn, cps, look, onReplay }: { line: Line; tagsOn: boolean; cps: number; look: GameLook; onReplay(): void }) {
  const text = line.text.trim() ? line.text : '효과 미리보기';
  const parsed = useMemo(() => parseTagged(text, tagsOn, gameFont), [text, tagsOn]);
  const { shown, click } = useReveal(parsed, cps);
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const style = line.say ?? {};

  // 칸에 들어가는 가장 큰 글자 크기를 찾는다. 아직 안 나온 글자도 자리를 차지해서 크기가 흔들리지 않는다
  useLayoutEffect(() => {
    const b = box.current;
    const t = inner.current;
    if (!b || !t) return;
    let lo = PREVIEW_MIN;
    let hi = PREVIEW_MAX;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      t.style.fontSize = mid + 'px';
      if (t.scrollHeight <= b.clientHeight && t.scrollWidth <= b.clientWidth) lo = mid;
      else hi = mid - 1;
    }
    t.style.fontSize = lo + 'px';
  }, [text, style.font, tagsOn]);

  return (
    <div
      ref={box}
      className="preview"
      title="클릭: 다시 보기"
      style={{ '--game-font': `${gameFont(look.font) ?? 'var(--font)'}, var(--font)` } as React.CSSProperties}
      onClick={() => click() || onReplay()}
    >
      <div
        ref={inner}
        className={'preview-text fx-' + (style.effect || 'none')}
        style={{ color: style.color ?? look.textColor, fontFamily: fontStack(style.font) }}
      >
        <Glyphs parsed={parsed} shown={shown} />
      </div>
      <button className="preview-again" title="다시 보기" onClick={(e) => (e.stopPropagation(), onReplay())}>↺</button>
    </div>
  );
}

// 대사창
export const SayBox = forwardRef<SayBoxHandle, {
  line: Line;
  who: { name: string; color?: string } | null;
  look: GameLook;
  tagsOn: boolean;
  wait: number;
  onDone(done: boolean): void;
  onNoWait(): void;
  onEdit(): void;
}>(function SayBox({ line, who, look, tagsOn, wait, onDone, onNoWait, onEdit }, ref) {
  const style = line.say ?? {};
  const parsed = useMemo(() => parseTagged(line.text, tagsOn, gameFont), [line.text, tagsOn]);
  const { shown, done, click } = useReveal(parsed, lineCps(style) ?? look.textCps, wait);

  useEffect(() => {
    onDone(done);
    if (done && parsed.noWait) onNoWait();
  }, [done]);

  useImperativeHandle(ref, () => ({ click }));

  const size = style.size ?? look.textSize;
  const windowTop = (look.height - look.textboxHeight) * look.textboxYalign;
  return (
    <div
      className="textbox"
      title="클릭: 다음, 더블클릭: 이 줄 편집"
      onDoubleClick={(e) => (e.stopPropagation(), onEdit())}
      style={{
        top: windowTop,
        height: look.textboxHeight,
        backgroundImage: look.textbox ? `url(${look.textbox})` : undefined,
        backgroundColor: look.textbox ? undefined : 'rgba(0,0,0,.62)',
      }}
    >
      {who && (
        <div
          className="name"
          style={{
            left: style.name_x ?? look.nameX,
            top: style.name_y ?? look.nameY,
            fontSize: style.name_size ?? look.nameSize,
            color: style.name_color ?? who.color ?? look.textColor,
            fontFamily: fontStack(style.name_font),
            backgroundImage: look.namebox ? `url(${look.namebox})` : undefined,
          }}
        >
          {who.name}
        </div>
      )}
      <div
        className={'say fx-' + (style.effect || 'none')}
        style={{
          left: style.x ?? look.dialogueX,
          top: style.y ?? look.dialogueY,
          width: look.dialogueWidth,
          fontSize: size,
          color: style.color ?? look.textColor,
          fontFamily: fontStack(style.font),
        }}
      >
        <Glyphs parsed={parsed} shown={shown} />
      </div>
    </div>
  );
});
