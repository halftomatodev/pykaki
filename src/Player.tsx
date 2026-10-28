import { useCallback, useEffect, useState } from 'react';
import { useStore } from './store';
import { advance, choose, start, type PState } from './playEngine';
import { renderTagged } from './textTags';
import type { Choice } from './types';
import { isTyping } from './util';

interface LogItem { who: string | null; text: string; choice?: boolean }

export function Player({ active }: { active: boolean }) {
  const project = useStore((s) => s.project);
  const playing = useStore((s) => s.playing);
  const session = useStore((s) => s.playSession);
  const [st, setSt] = useState<PState | null>(null);
  const [hist, setHist] = useState<{ st: PState; log: LogItem[] }[]>([]);
  const [log, setLog] = useState<LogItem[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [auto, setAuto] = useState(false);

  const nameOf = (who?: string) => project.characters.find((c) => c.id === who);
  const entry = (s: PState): LogItem | null => (s.show ? { who: s.show.type === 'say' ? nameOf(s.show.who)?.name ?? s.show.who ?? '?' : null, text: s.show.text } : null);

  // 새 플레이 시작
  useEffect(() => {
    if (!session || !useStore.getState().playing) return;
    const s = useStore.getState();
    const s0 = start(s.project, s.playStart ?? s.project.project.startNode);
    setSt(s0);
    setHist([]);
    const e = entry(s0);
    setLog(e ? [e] : []);
    setAuto(false);
  }, [session]);

  useEffect(() => {
    if (!playing) setSt(null);
  }, [playing]);

  // 캔버스에 현재 위치와 지나온 길 표시
  useEffect(() => {
    if (!playing || !st) return;
    useStore.setState({ play: { current: st.showNode ?? st.node, visitedNodes: st.visited, visitedEdges: st.edges } });
  }, [st, playing]);

  const push = (next: PState, extra: LogItem[] = []) => {
    if (!st) return;
    setHist((h) => [...h.slice(-200), { st, log }]);
    const e = next.show !== st.show ? entry(next) : null;
    setLog((l) => [...l, ...extra, ...(e ? [e] : [])]);
    setSt(next);
  };

  const next = useCallback(() => {
    if (!st || st.menu || st.ended) return;
    push(advance(useStore.getState().project, st));
  }, [st, log]);

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

  // 자동 진행
  useEffect(() => {
    if (!auto || !st || st.menu || st.ended) return;
    const t = setTimeout(next, 1200 + (st.show?.text.length ?? 0) * 40);
    return () => clearTimeout(t);
  }, [auto, st, next]);

  // 스페이스/엔터: 다음, ←: 뒤로
  useEffect(() => {
    if (!active || !playing) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.key === ' ' || e.key === 'Enter') (e.preventDefault(), next());
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const editLine = () => {
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
        <p className="tip">특정 상자부터 하려면 상자를 고르고 [▶ 여기서 플레이]를 누르세요.</p>
      </div>
    );

  const show = st.show;
  const ch = show?.type === 'say' ? nameOf(show.who) : undefined;
  const cur = project.nodes.find((n) => n.id === (st.showNode ?? st.node));
  const curGroup = project.labels.find((g) => g.id === cur?.group);
  const tagsOn = project.settings.allowTextTags;

  return (
    <div className="player">
      <div className="stage">
        <div className="cmds">
          {st.commands.map((c, i) => (
            <span key={i}>{c}</span>
          ))}
        </div>
        {st.menu && (
          <div className="pmenu">
            {st.menu.map((c) => (
              <button key={c.id} onClick={() => pick(c)} className={c.target ? '' : 'broken'}>
                {renderTagged(c.text || '(빈 선택지)', tagsOn)}
              </button>
            ))}
          </div>
        )}
        {st.ended && (
          <div className={'ended ' + st.ended}>
            {st.ended === 'end' && '■ 끝 (return)'}
            {st.ended === 'broken' && '⚠ 여기서 흐름이 끊겼어요 (연결 안 된 선)'}
            {st.ended === 'missing' && '⚠ 없는 상자로 이동했어요'}
            {st.ended === 'loop' && '⚠ 대사 없이 계속 도는 흐름이 있어요'}
            {st.brokenAt && (
              <button onClick={() => (useStore.getState().select([st.brokenAt!]), useStore.getState().focusNodes([st.brokenAt!]))}>그 상자로 가기</button>
            )}
          </div>
        )}
        {show && (
          <div className="textbox" onClick={next} onDoubleClick={editLine} title="클릭: 다음 · 더블클릭: 이 줄 편집">
            {show.type === 'say' && (
              <div className="name" style={{ color: ch?.color ?? '#fca5a5' }}>
                {ch?.name ?? show.who}
                {show.attr && <small> ({show.attr})</small>}
              </div>
            )}
            <div className={show.type === 'narration' ? 'say narr' : 'say'}>{renderTagged(show.text, tagsOn)}</div>
          </div>
        )}
      </div>

      <div className="ctrl">
        <button onClick={back} disabled={!hist.length} title="← 키">◀ 뒤로</button>
        <button onClick={next} disabled={!!st.menu || !!st.ended} title="스페이스/엔터">다음 ▶</button>
        <button className={auto ? 'on' : ''} onClick={() => setAuto((v) => !v)}>자동</button>
        <button onClick={skip} disabled={!!st.menu || !!st.ended}>선택지까지 건너뛰기</button>
        <button className={showLog ? 'on' : ''} onClick={() => setShowLog((v) => !v)}>기록</button>
        <button onClick={() => useStore.getState().startPlay(useStore.getState().playStart)}>↺ 다시</button>
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
        <div className="tip">명령(show/scene 등)은 실행하지 않고 위쪽 뱃지로만 보여요. 플레이 중에도 대본을 고치면 다음 줄부터 반영돼요.</div>
      </div>
    </div>
  );
}
