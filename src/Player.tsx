import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from './store';
import { advance, choose, start, type PState } from './playEngine';
import { renderTagged } from './textTags';
import type { Choice } from './types';
import { isTyping } from './util';
import { soundUrl, useGameFolder } from './gameFolder';
import { GameFrame, SayBox, Scene, type SayBoxHandle } from './PlayStage';
import { enterFullPlay, leaveFullPlay } from './actions';
import { keyOf } from './prefs';

interface LogItem { who: string | null; text: string; choice?: boolean }

// 음악과 효과음. 대본이 바꾼 값을 따라간다
function usePlayAudio(st: PState | null, playing: boolean) {
  const music = useRef<HTMLAudioElement | null>(null);
  const musicFile = useRef<string | null>(null);
  const lastSound = useRef(0);
  const want = playing ? st?.stage.music ?? null : null;

  useEffect(() => {
    if (want === musicFile.current) return;
    musicFile.current = want;
    music.current?.pause();
    music.current = null;
    if (!want) return;
    soundUrl(want).then((u) => {
      if (!u || musicFile.current !== want) return;
      const a = new Audio(u);
      a.loop = true;
      music.current = a;
      a.play().catch(() => {});
    });
  }, [want]);

  const seq = st?.stage.soundSeq ?? 0;
  const sound = st?.stage.sound;
  useEffect(() => {
    // 뒤로 갈 때는 소리를 다시 내지 않는다
    if (playing && sound && seq > lastSound.current) void soundUrl(sound).then((u) => void (u && new Audio(u).play().catch(() => {})));
    lastSound.current = seq;
  }, [seq]);

  useEffect(() => () => {
    musicFile.current = null;
    music.current?.pause();
  }, []);
}

export function Player({ active }: { active: boolean }) {
  const project = useStore((s) => s.project);
  const playing = useStore((s) => s.playing);
  const session = useStore((s) => s.playSession);
  const full = useStore((s) => s.fullPlay);
  const look = useGameFolder((s) => s.look);
  const linked = useGameFolder((s) => !!s.name);
  const [st, setSt] = useState<PState | null>(null);
  const [hist, setHist] = useState<{ st: PState; log: LogItem[] }[]>([]);
  const [log, setLog] = useState<LogItem[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [auto, setAuto] = useState(false);
  const [lineDone, setLineDone] = useState(true);
  const box = useRef<SayBoxHandle>(null);

  const nameOf = (who?: string) => project.characters.find((c) => c.id === who);
  const entry = (s: PState): LogItem | null => (s.show ? { who: s.show.type === 'say' ? nameOf(s.show.who)?.name ?? s.show.who ?? '?' : null, text: s.show.text } : null);

  // 새 플레이 시작
  useEffect(() => {
    if (!session || !useStore.getState().playing) return;
    const s = useStore.getState();
    const s0 = start(s.project, s.playStart ?? s.project.project.startNode, s.playLine);
    setSt(s0);
    setHist([]);
    const e = entry(s0);
    setLog(e ? [e] : []);
    setAuto(false);
  }, [session]);

  useEffect(() => {
    if (!playing) setSt(null);
  }, [playing]);

  usePlayAudio(st, playing);

  // 캔버스에 현재 위치와 지나온 길 표시
  useEffect(() => {
    if (!playing || !st) return;
    useStore.setState({ play: { current: st.showNode ?? st.node, line: st.show?.id ?? null, visitedNodes: st.visited, visitedEdges: st.edges } });
  }, [st, playing]);

  const push = (next: PState, extra: LogItem[] = []) => {
    if (!st) return;
    setHist((h) => [...h.slice(-200), { st, log }]);
    const e = next.show !== st.show ? entry(next) : null;
    setLog((l) => [...l, ...extra, ...(e ? [e] : [])]);
    setSt(next);
  };

  // 글자가 아직 나오는 중이면 먼저 다 보여 준다 (렌파이와 같음)
  const step = useCallback(() => {
    if (!st || st.menu || st.ended) return;
    push(advance(useStore.getState().project, st));
  }, [st, log]);
  const next = () => {
    if (box.current?.click()) return;
    if (full && st?.ended) return leaveFullPlay();
    step();
  };

  const pick = (c: Choice) => st && push(choose(useStore.getState().project, st, c), [{ who: null, text: '▶ ' + c.text, choice: true }]);

  const back = () => {
    const h = hist[hist.length - 1];
    if (!h) return;
    setSt(h.st);
    setLog(h.log);
    setHist(hist.slice(0, -1));
  };

  const skip = () => {
    if (!st) return;
    let s = st;
    const extra: LogItem[] = [];
    for (let i = 0; i < 500 && !s.menu && !s.ended; i++) {
      s = advance(useStore.getState().project, s);
      const e = entry(s);
      if (e && !s.menu && !s.ended) extra.push(e);
    }
    setHist((h) => [...h, { st, log }]);
    setLog((l) => [...l, ...extra]);
    setSt(s);
  };

  // 자동 진행: 글자가 다 나온 뒤에 잠시 기다린다
  useEffect(() => {
    if (!auto || !st || st.menu || st.ended || !lineDone) return;
    const t = setTimeout(step, 800 + (st.show?.text.length ?? 0) * 40);
    return () => clearTimeout(t);
  }, [auto, st, step, lineDone]);

  // 스페이스/엔터: 다음, ←: 뒤로. 전체화면에서는 Esc로 나간다
  useEffect(() => {
    if ((!active && !full) || !playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.key === ' ' || e.key === 'Enter') (e.preventDefault(), next());
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') back();
      else if (e.key === 'Escape' && full) leaveFullPlay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const editLine = () => {
    if (full) return leaveFullPlay();
    if (!st?.show || !st.showNode) return;
    const s = useStore.getState();
    s.select([st.showNode]);
    useStore.setState({ tab: 'edit', focusLineId: st.show.id });
  };

  if (!playing || !st)
    return (
      <div className="hint">
        <p>대본을 렌파이 대화창처럼 미리 플레이해 봐요.</p>
        <button className="primary" onClick={() => useStore.getState().startPlay(null)}>▶ 처음부터 플레이</button>
        <p className="tip">특정 상자부터 하려면 상자를 고르고 [▶ 여기서 플레이]를 누르세요. {keyOf('fullPlay')}를 누르면 고른 상자부터 전체화면으로 플레이해요.</p>
      </div>
    );

  const show = st.show;
  const ch = show?.type === 'say' ? nameOf(show.who) : undefined;
  const cur = project.nodes.find((n) => n.id === (st.showNode ?? st.node));
  const curGroup = project.labels.find((g) => g.id === cur?.group);
  const tagsOn = project.settings.allowTextTags;

  const game = (
    <GameFrame
      look={look}
      full={full}
      onClick={next}
      top={
        <div className="ptop">
          {st.stage.fx && <span title="화면 효과는 렌파이에서 실제로 보여요">화면 효과: {st.stage.fx}</span>}
          {st.commands.map((c, i) => (
            <span key={i} title="플레이 화면에서 실행하지 않는 명령이에요">{c}</span>
          ))}
        </div>
      }
    >
      <Scene stage={st.stage} look={look} />
      {show && !st.menu && (
        <SayBox
          key={show.id + '-' + session + '-' + hist.length}
          ref={box}
          line={show}
          who={show.type === 'say' ? { name: ch?.name ?? show.who ?? '', color: ch?.color } : null}
          look={look}
          tagsOn={tagsOn}
          wait={st.stage.wait}
          onDone={setLineDone}
          onNoWait={step}
          onEdit={editLine}
        />
      )}
      {st.menu && (
        <div className="pmenu" style={{ fontSize: look.textSize }}>
          {st.menu.map((c) => (
            <button key={c.id} onClick={(e) => (e.stopPropagation(), pick(c))} className={c.target ? '' : 'broken'}>
              {renderTagged(c.text || '(빈 선택지)', tagsOn)}
            </button>
          ))}
        </div>
      )}
      {st.ended && (
        <div className={'ended ' + st.ended} style={{ fontSize: look.textSize }}>
          {st.ended === 'end' && '■ 끝 (return)'}
          {st.ended === 'broken' && '⚠ 여기서 흐름이 끊겼어요 (연결 안 된 선)'}
          {st.ended === 'missing' && '⚠ 없는 상자로 이동했어요'}
          {st.ended === 'loop' && '⚠ 대사 없이 계속 도는 흐름이 있어요'}
          {st.brokenAt && !full && (
            <button onClick={() => (useStore.getState().select([st.brokenAt!]), useStore.getState().focusNodes([st.brokenAt!]))}>그 상자로 가기</button>
          )}
          {full && <small>클릭하면 편집 화면으로 돌아가요</small>}
        </div>
      )}
    </GameFrame>
  );

  return (
    <div className="player">
      {full ? createPortal(game, document.body) : game}

      <div className="ctrl">
        <button onClick={back} disabled={!hist.length} title="← 키">◀ 뒤로</button>
        <button onClick={next} disabled={!!st.menu || !!st.ended} title="스페이스/엔터">다음 ▶</button>
        <button className={auto ? 'on' : ''} onClick={() => setAuto((v) => !v)}>자동</button>
        <button onClick={skip} disabled={!!st.menu || !!st.ended}>선택지까지 건너뛰기</button>
        <button className={showLog ? 'on' : ''} onClick={() => setShowLog((v) => !v)}>기록</button>
        <button onClick={() => useStore.getState().startPlay(useStore.getState().playStart)}>↺ 다시</button>
        <button onClick={() => void enterFullPlay()} title={keyOf('fullPlay')}>⛶ 전체화면</button>
        <button className="danger" onClick={() => (useStore.getState().stopPlay(), useStore.setState({ tab: 'edit' }))}>■ 종료</button>
      </div>

      {showLog && (
        <div className="plog">
          {log.map((l, i) => (
            <div key={i} className={l.choice ? 'c' : ''}>
              {l.who && <b>{l.who}: </b>}
              {l.text}
            </div>
          ))}
        </div>
      )}

      <div className="dbg">
        <div>label: <code>{curGroup?.name ?? '-'}</code> · 상자: {cur?.title || cur?.id || '-'}</div>
        <div>call 스택: {st.stack.length ? st.stack.map((x) => project.nodes.find((n) => n.id === x.from)?.title || x.from).join(' → ') : '(없음)'}</div>
        <div className="tip">
          {linked ? '연결한 폴더의 그림, 영상, 소리로 보여 줘요.' : '렌파이 폴더를 연결하면 그림, 영상, 소리도 나와요.'} 화면 효과와 직접 적은 코드는 렌파이에서 확인하세요. 플레이 중에도 대본을 고치면 다음 줄부터 반영돼요.
        </div>
      </div>
    </div>
  );
}
