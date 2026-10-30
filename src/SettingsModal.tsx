// 환경 설정 창: 화면 색, 단축키 바꾸기
import { useEffect, useState } from 'react';
import { useStore } from './store';
import { ACTIONS, DIMS, FONTS, THEMES, colorsOf, ensureNeodgm, ensurePretendard, comboLabel, comboOf, resetKeys, usePrefs, type ActionId, type Colors } from './prefs';

const close = () => useStore.setState({ showPrefs: false });

export function SettingsModal() {
  return (
    <div className="modal-bg" onClick={close}>
      <div className="modal prefs" onClick={(e) => e.stopPropagation()}>
        <h3>환경 설정</h3>
        <p className="tip">이 브라우저에만 저장돼요. 대본 파일에는 들어가지 않아요.</p>
        <ColorPrefs />
        <LookPrefs />
        <KeyPrefs />
        <div className="row end">
          <button onClick={close}>닫기</button>
        </div>
      </div>
    </div>
  );
}

function ColorPrefs() {
  const p = usePrefs();
  const cur = colorsOf(p);
  const setCustom = (k: keyof Colors, v: string) => usePrefs.setState({ theme: 'custom', custom: { ...cur, [k]: v } });
  const pickers: [keyof Colors, string][] = [['bg', '바탕'], ['panel', '면'], ['text', '글자'], ['accent', '강조']];
  return (
    <>
      <h4>화면 색</h4>
      <div className="row">
        {THEMES.map((t) => (
          <button key={t.id} className={'swatch' + (p.theme === t.id ? ' on' : '')} onClick={() => usePrefs.setState({ theme: t.id })} style={{ background: t.colors.bg, color: t.colors.text, borderColor: t.colors.accent }}>
            {t.label}
          </button>
        ))}
        <button className={'swatch' + (p.theme === 'custom' ? ' on' : '')} onClick={() => usePrefs.setState({ theme: 'custom', custom: { ...cur } })}>
          직접 고르기
        </button>
      </div>
      <div className="row">
        {pickers.map(([k, label]) => (
          <label key={k} className="pick">
            <input type="color" value={cur[k]} onChange={(e) => setCustom(k, e.target.value)} />
            {label}
          </label>
        ))}
      </div>
      <p className="tip">색을 바꾸면 "직접 고르기"로 저장돼요. label 상자 색은 왼쪽 label 목록에서 바꿔요.</p>
      <div className="row">
        <label className="pick" htmlFor="box-strength">상자 진하기</label>
        <input id="box-strength" type="range" min={0} max={100} step={5} value={p.boxStrength} onChange={(e) => usePrefs.setState({ boxStrength: +e.target.value })} />
        <span className="tip">{p.boxStrength}%</span>
      </div>
      <div className="row">
        <label className="pick" htmlFor="label-tint">label 색 입히기</label>
        <input id="label-tint" type="range" min={0} max={100} step={5} value={p.labelTint} onChange={(e) => usePrefs.setState({ labelTint: +e.target.value })} />
        <span className="tip">{p.labelTint}%</span>
      </div>
      <div className="row">
        <label className="pick" htmlFor="frame-w">label 경계선</label>
        <input id="frame-w" type="range" min={1} max={6} step={0.5} value={p.frameWidth} onChange={(e) => usePrefs.setState({ frameWidth: +e.target.value })} />
        <span className="tip">{p.frameWidth}px</span>
      </div>
      <p className="tip">상자 진하기는 상자, label 배경, 이름표를 얼마나 진하게 칠할지, label 색 입히기는 상자와 label 배경에 label 색을 얼마나 진하게 넣을지(높이면 label별로 구분하기 쉬워요), label 경계선은 같은 label 상자를 묶는 선의 굵기예요(Apple 스타일은 선 없이 색으로만 구분해요). 낮출수록 글만 남은 것처럼 보여요. 1비트 테마는 칠하지 않아서 상자 진하기를 쓰지 않아요(경계선 굵기는 써요).</p>
    </>
  );
}

function LookPrefs() {
  const font = usePrefs((p) => p.font);
  const dim = usePrefs((p) => p.dim);
  useEffect(() => (ensureNeodgm(), ensurePretendard()), []);
  return (
    <>
      <h4>글꼴</h4>
      <div className="row">
        {FONTS.map((f) => (
          <button key={f.id} className={'swatch' + (font === f.id ? ' on' : '')} style={{ fontFamily: f.family, fontWeight: f.weight }} onClick={() => usePrefs.setState({ font: f.id })}>
            {f.label} · 가나다 Abc 123
          </button>
        ))}
      </div>
      <p className="tip">화면 전체에 적용돼요. Pretendard는 숫자가 클수록 굵어요. 두 글꼴 모두 SIL Open Font License로 배포되는 무료 글꼴이고, 파일 안에 들어 있어서 인터넷 없이도 보여요.</p>

      <h4>집중 모드 흐림</h4>
      <div className="row">
        {DIMS.map((d) => (
          <button key={d.id} className={'swatch' + (dim === d.id ? ' on' : '')} onClick={() => usePrefs.setState({ dim: d.id })}>
            {d.label}
          </button>
        ))}
      </div>
      <p className="tip">집중 모드에서 상자 안에 글을 쓰는 동안, 커서가 있는 줄 말고는 흐려지고 다른 상자는 더 흐려져요. 흐린 상자에 마우스를 올리면 잠깐 또렷해져요.</p>
    </>
  );
}

function KeyPrefs() {
  const keys = usePrefs((s) => s.keys);
  const [rec, setRec] = useState<ActionId | null>(null);
  const [msg, setMsg] = useState('');

  // 바꾸는 중에는 누른 키를 가로채서 그 동작에 붙인다
  useEffect(() => {
    if (!rec) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') return setRec(null);
      const c = comboOf(e);
      if (!c) return;
      const fn = /^F\d+$/.test(e.code);
      if (!fn && !e.ctrlKey && !e.metaKey && !e.altKey) return setMsg('글자를 칠 때 겹치지 않게 Ctrl이나 Alt를 함께 눌러 주세요 (F1~F12는 혼자 써도 돼요).');
      const next = { ...usePrefs.getState().keys, [rec]: c };
      const other = ACTIONS.find((a) => a.id !== rec && next[a.id] === c);
      if (other) next[other.id] = '';
      usePrefs.setState({ keys: next });
      setMsg(other ? `"${other.label}"에 쓰던 키라서 그쪽은 비웠어요.` : '');
      setRec(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [rec]);

  return (
    <>
      <h4>단축키</h4>
      <table className="keys">
        <tbody>
          {ACTIONS.map((a) => (
            <tr key={a.id}>
              <td>{a.label}</td>
              <td>
                <button className={'key' + (rec === a.id ? ' rec' : '')} onClick={() => (setMsg(''), setRec(rec === a.id ? null : a.id))}>
                  {rec === a.id ? '키를 누르세요… (Esc 취소)' : comboLabel(keys[a.id])}
                </button>
              </td>
              <td>
                {keys[a.id] && (
                  <button className="x" title="단축키 없애기" onClick={() => usePrefs.setState({ keys: { ...keys, [a.id]: '' } })}>✕</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {msg && <p className="tip warn-text">{msg}</p>}
      <div className="row">
        <button onClick={() => (resetKeys(), setMsg('기본값으로 되돌렸어요.'))}>기본값으로</button>
        <span className="tip">Esc(편집 끝내기), Delete(삭제)는 바꿀 수 없어요.</span>
      </div>
    </>
  );
}
