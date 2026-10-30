// 환경 설정 창: 화면 색, 단축키 바꾸기
import { useEffect, useState } from 'react';
import { useStore } from './store';
import { ACTIONS, THEMES, colorsOf, comboLabel, comboOf, resetKeys, usePrefs, type ActionId, type Colors } from './prefs';

const close = () => useStore.setState({ showPrefs: false });

export function SettingsModal() {
  return (
    <div className="modal-bg" onClick={close}>
      <div className="modal prefs" onClick={(e) => e.stopPropagation()}>
        <h3>환경 설정</h3>
        <p className="tip">이 브라우저에만 저장돼요. 대본 파일에는 들어가지 않아요.</p>
        <ColorPrefs />
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
