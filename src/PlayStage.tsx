// 플레이 화면: 게임 해상도 그대로 그린 뒤 창 크기에 맞춰 줄인다. 값은 연결한 game 폴더(gui.rpy 등)에서 읽는다
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Line } from './types';
import type { PStage, Sprite } from './playEngine';
import { transInfo } from './playEngine';
import { parseTagged } from './textTags';
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

// 대사창. 속도(글자/초)와 멈춤 태그에 맞춰 글자를 하나씩 내보낸다
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
  const cps = style.cps ?? look.textCps;
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
    onDone(done);
    if (done && parsed.noWait) onNoWait();
  }, [done]);

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

  useImperativeHandle(ref, () => ({
    click() {
      if (holding) return setHolding(false), true;
      if (shown < limit) return setShown(limit), true;
      if (stop) return setPassed((v) => v + 1), true;
      return false;
    },
  }), [holding, shown, limit, stop]);

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
        {parsed.glyphs.map((g, i) =>
          g.ch === '\n' ? (
            <br key={i} />
          ) : (
            <span key={i} className={'ch' + (i < shown && !holding ? ' on' : '')} style={{ ...g.style, '--i': i } as React.CSSProperties}>{g.ch}</span>
          ),
        )}
      </div>
    </div>
  );
});
