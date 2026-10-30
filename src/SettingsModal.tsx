// 환경 설정 창: 화면 색, 단축키 바꾸기
import { useEffect, useState } from 'react';
import { useStore } from './store';
import { ACTIONS, DIMS, FONTS, GRAD_DEFAULTS, THEMES, colorsOf, gradColors, gradOf, ensureNeodgm, ensurePretendard, comboLabel, comboOf, resetKeys, resetPrefs, usePrefs, type ActionId, type Colors } from './prefs';

const close = () => useStore.setState({ showPrefs: false });

export function SettingsModal() {
  return (
    <div className="modal-bg" onClick={close}>
      <div className="modal prefs" onClick={(e) => e.stopPropagation()}>
        <h3>환경 설정</h3>
        <p className="tip">화면 설정은 이 브라우저에만 저장돼요. 상자 색만 대본 파일에 저장돼요.</p>
        <ColorPrefs />
        <LookPrefs />
        <BoxColors />
        <KeyPrefs />
        <div className="row end">
          <button
            className="danger"
            title="화면 테마, 글꼴, 집중 모드 흐림, 단축키를 모두 처음 값으로. 대본과 상자 색은 그대로예요"
            onClick={() => confirm('화면 테마, 글꼴, 집중 모드 흐림, 단축키를 모두 처음 값으로 되돌릴까요?\n대본과 상자 색은 그대로예요.') && (resetPrefs(), useStore.getState().say('설정을 처음 값으로 되돌렸어요'))}
          >
            모든 설정을 처음 값으로
          </button>
          <span className="sp" />
          <button onClick={close}>닫기</button>
        </div>
      </div>
    </div>
  );
}

function ColorPrefs() {
  const p = usePrefs();
  const cur = colorsOf(p);
  const grad = gradOf(p);
  const setCustom = (k: keyof Colors, v: string) => usePrefs.setState({ custom: { ...p.custom, [k]: v } });
  const setGrad = (k: 'a' | 'b', v: string) => grad && usePrefs.setState({ grads: { ...p.grads, [grad]: { ...p.grads[grad], [k]: v } } });
  const pickers: [keyof Colors, string][] = [['bg', '바탕'], ['panel', '면'], ['box', '상자'], ['text', '텍스트']];
  const preview = (c: Colors) => ({ background: c.bg, color: c.text, borderColor: c.box ?? c.accent });
  return (
    <>
      <h4>화면 테마</h4>
      <div className="row">
        {THEMES.map((t) => {
          const c = t.grad ? gradColors(p.grads[t.grad]) : t.colors;
          return (
            <button key={t.id} className={'swatch' + (p.theme === t.id ? ' on' : '')} onClick={() => usePrefs.setState({ theme: t.id })} style={preview(c)}>
              {t.label}
            </button>
          );
        })}
        <button
          className={'swatch' + (p.theme === 'custom' ? ' on' : '')}
          onClick={() => usePrefs.setState({ theme: 'custom', custom: p.theme === 'custom' ? p.custom : { ...cur, box: cur.box ?? cur.panel, label: undefined } })}
        >
          직접 고르기
        </button>
      </div>
      {grad && (
        <>
          <div className="row">
            <label className="pick">
              <input type="color" value={p.grads[grad].a} onChange={(e) => setGrad('a', e.target.value)} />
              바탕 색
            </label>
            <span className="grad-bar" style={{ background: `linear-gradient(90deg, ${p.grads[grad].a}, ${p.grads[grad].b})` }}>
              <i style={{ left: '30%' }} title="label 배경" />
              <i style={{ left: '55%' }} title="상자" />
            </span>
            <label className="pick">
              <input type="color" value={p.grads[grad].b} onChange={(e) => setGrad('b', e.target.value)} />
              끝 색
            </label>
            <button onClick={() => usePrefs.setState({ grads: { ...p.grads, [grad]: { ...GRAD_DEFAULTS[grad] } } })}>처음 색</button>
          </div>
          <p className="tip">두 색 사이를 이어서 바탕 → label 배경(30%) → 상자(55%) 순서로 자동으로 칠해요. 글자색도 밝기에 맞춰 정해져요.</p>
        </>
      )}
      {p.theme === 'custom' && (
        <div className="row">
          {pickers.map(([k, label]) => (
            <label key={k} className="pick">
              <input type="color" value={p.custom[k] ?? p.custom.panel} onChange={(e) => setCustom(k, e.target.value)} />
              {label}
            </label>
          ))}
        </div>
      )}
      <div className="row">
        <label className="pick" htmlFor="frame-w">label 경계선</label>
        <input id="frame-w" type="range" min={0} max={6} step={0.5} value={p.frameWidth} onChange={(e) => usePrefs.setState({ frameWidth: +e.target.value })} />
        <span className="tip">{p.frameWidth ? p.frameWidth + 'px' : '안 보임'}</span>
      </div>
      <p className="tip">label 경계선은 같은 label 상자를 묶는 선의 굵기예요. 0이면 선이 안 보여요. 사과 스타일은 label 배경을 왼쪽 label 목록의 색으로 칠해요.</p>
    </>
  );
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
// #abc → #aabbcc
const fullHex = (h: string) => (h.length === 4 ? '#' + [...h.slice(1)].map((x) => x + x).join('') : h).toLowerCase();

// 상자 색 한꺼번에 바꾸기. 대본 파일에 저장되는 값이라 실행 취소가 된다
function BoxColors() {
  const project = useStore((s) => s.project);
  const sel = useStore((s) => s.selectedIds);
  const [target, setTarget] = useState(sel.length ? 'sel' : 'all');
  const [color, setColor] = useState('#007aff');
  const [hex, setHex] = useState('#007aff');
  const ids = target === 'all' ? project.nodes.map((n) => n.id) : target === 'sel' ? sel : project.nodes.filter((n) => n.group === target).map((n) => n.id);
  const paint = (c: string | undefined) => {
    useStore.getState().update((p) => {
      for (const n of p.nodes) if (ids.includes(n.id)) c ? (n.color = c) : delete n.color;
    });
    useStore.getState().say(c ? `상자 ${ids.length}개를 칠했어요` : `상자 ${ids.length}개를 label 색으로 되돌렸어요`);
  };
  return (
    <>
      <h4>상자 색 (이 대본에 저장)</h4>
      <div className="row">
        <label className="pick" htmlFor="bc-target">바꿀 상자</label>
        <select id="bc-target" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="all">모든 상자 ({project.nodes.length})</option>
          <option value="sel" disabled={!sel.length}>선택한 상자 ({sel.length})</option>
          {project.labels.map((g) => (
            <option key={g.id} value={g.id}>
              label: {g.title ? `${g.title} (${g.name})` : g.name} ({project.nodes.filter((n) => n.group === g.id).length})
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <label className="pick" htmlFor="bc-color">색</label>
        <input id="bc-color" type="color" className="bc-big" value={color} onChange={(e) => (setColor(e.target.value), setHex(e.target.value))} title="눌러서 색 고르기" />
        <input
          className={'bc-hex' + (HEX.test(hex) ? '' : ' invalid')}
          value={hex}
          placeholder="#007aff"
          maxLength={7}
          spellCheck={false}
          onChange={(e) => {
            const v = e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value;
            setHex(v);
            if (HEX.test(v)) setColor(fullHex(v));
          }}
          title="hex 코드 (#RRGGBB 또는 #RGB)"
        />
      </div>
      <div className="row">
        <button className="primary" disabled={!ids.length} onClick={() => paint(color)}>칠하기</button>
        <button disabled={!ids.length} onClick={() => paint(undefined)}>label 색으로 되돌리기</button>
      </div>
      <p className="tip">색 칸을 눌러 고르거나 hex 코드(#RRGGBB)를 직접 적어요. 고른 색은 대본 파일에 저장되고 실행 취소(Ctrl+Z)가 돼요.</p>
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
