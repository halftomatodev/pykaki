import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, MarkerType, applyNodeChanges, useReactFlow,
  type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type OnConnectEnd,
} from '@xyflow/react';
import { useStore } from './store';
import { BoxView, GroupFrame } from './BoxView';
import * as ops from './ops';
import { addBoxAt, editBox } from './actions';

const nodeTypes = { box: BoxView, frame: GroupFrame };
const FRAME_PAD = 22;
const FRAME_HEAD = 24;

export function Canvas() {
  const project = useStore((s) => s.project);
  const selectedIds = useStore((s) => s.selectedIds);
  const play = useStore((s) => s.play);
  const focusReq = useStore((s) => s.focusReq);
  const animating = useStore((s) => s.animating);
  const update = useStore((s) => s.update);
  const rf = useReactFlow();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selEdge, setSelEdge] = useState<string | null>(null);
  const fitted = useRef(false);

  // 프로젝트가 바뀌면 화면 상자를 다시 만든다 (크기 측정값은 유지)
  useEffect(() => {
    setNodes((prev) => {
      const old = new Map(prev.map((n) => [n.id, n]));
      return project.nodes.map((b) => ({
        id: b.id,
        type: 'box',
        position: { ...b.pos },
        data: {},
        selected: selectedIds.includes(b.id),
        measured: old.get(b.id)?.measured,
      }));
    });
  }, [project, selectedIds]);

  useEffect(() => {
    if (fitted.current || !nodes.length || !nodes.every((n) => n.measured)) return;
    fitted.current = true;
    rf.fitView({ padding: 0.2, maxZoom: 1 });
  }, [nodes, rf]);

  // label 묶음 배경(프레임)
  const frames = useMemo(() => {
    const groupOf = new Map(project.nodes.map((b) => [b.id, b.group]));
    const res: Node[] = [];
    for (const g of project.labels) {
      const ms = nodes.filter((n) => groupOf.get(n.id) === g.id);
      if (!ms.length) continue;
      const x1 = Math.min(...ms.map((n) => n.position.x)) - FRAME_PAD;
      const y1 = Math.min(...ms.map((n) => n.position.y)) - FRAME_PAD - FRAME_HEAD;
      const x2 = Math.max(...ms.map((n) => n.position.x + (n.measured?.width ?? 250))) + FRAME_PAD;
      const y2 = Math.max(...ms.map((n) => n.position.y + (n.measured?.height ?? 120))) + FRAME_PAD;
      res.push({
        id: 'frame:' + g.id, type: 'frame', position: { x: x1, y: y1 }, data: { groupId: g.id },
        width: x2 - x1, height: y2 - y1, style: { width: x2 - x1, height: y2 - y1 },
        draggable: false, selectable: false, connectable: false, deletable: false, focusable: false, zIndex: -1,
      });
    }
    return res;
  }, [nodes, project]);

  const allNodes = useMemo(() => [...frames, ...nodes], [frames, nodes]);

  const edges = useMemo<Edge[]>(() => {
    const groupOf = new Map(project.nodes.map((b) => [b.id, b.group]));
    const visited = new Set(play?.visitedEdges ?? []);
    const res: Edge[] = [];
    for (const b of project.nodes)
      for (const l of ops.exitLinks(b)) {
        if (!l.target || !groupOf.has(l.target)) continue;
        const id = `${b.id}|${l.handle}`;
        const cls = ['k-' + l.kind, groupOf.get(l.target) !== b.group ? 'cross' : '', visited.has(b.id + '>' + l.target) ? 'visited' : ''];
        res.push({
          id, source: b.id, sourceHandle: l.handle, target: l.target, targetHandle: 'in',
          className: cls.join(' '), selected: id === selEdge,
          label: l.kind === 'call' ? 'call' : l.kind === 'then' ? '복귀 후' : undefined,
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        });
      }
    return res;
  }, [project, play, selEdge]);

  // 플레이 중인 상자로 화면 이동
  useEffect(() => {
    if (!play?.current) return;
    const n = rf.getNode(play.current);
    if (!n) return;
    rf.setCenter(n.position.x + (n.measured?.width ?? 250) / 2, n.position.y + (n.measured?.height ?? 120) / 2, { zoom: rf.getZoom(), duration: 300 });
  }, [play?.current, rf]);

  useEffect(() => {
    if (focusReq?.ids.length) setTimeout(() => rf.fitView({ nodes: focusReq.ids.map((id) => ({ id })), duration: 400, padding: 0.3, maxZoom: 1.1 }), 30);
  }, [focusReq, rf]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((ns) => applyNodeChanges(changes.filter((c) => !('id' in c) || !String(c.id).startsWith('frame:')), ns));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    for (const c of changes) if (c.type === 'select') setSelEdge(c.selected ? c.id : null);
  }, []);

  const onConnect = useCallback((c: Connection) => update((p) => ops.connect(p, c.source, c.sourceHandle, c.target)), [update]);

  // 선을 빈 곳에 놓으면 새 상자를 만들어 연결, 상자 몸통에 놓으면 그 상자에 연결
  const onConnectEnd: OnConnectEnd = useCallback(
    (event, st) => {
      if (st.isValid || !st.fromNode || st.fromHandle?.type !== 'source') return;
      const src = st.fromNode.id;
      const handle = st.fromHandle.id ?? 'next';
      const pt = 'changedTouches' in event ? event.changedTouches[0] : event;
      const hit = (document.elementFromPoint(pt.clientX, pt.clientY) as HTMLElement | null)?.closest('.react-flow__node-box');
      const hitId = hit?.getAttribute('data-id');
      if (hitId) return update((p) => ops.connect(p, src, handle, hitId));
      const pos = rf.screenToFlowPosition({ x: pt.clientX, y: pt.clientY });
      const group = ops.findBox(useStore.getState().project, src)?.group;
      const id = addBoxAt({ x: pos.x - 125, y: pos.y }, group);
      update((p) => ops.connect(p, src, handle, id), 'connect-new');
    },
    [rf, update],
  );

  const onDoubleClick = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).classList.contains('react-flow__pane')) return;
    const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    // 묶음 배경 안을 더블클릭하면 그 label에 만든다
    const f = frames.find((f) => pos.x >= f.position.x && pos.x <= f.position.x + (f.width ?? 0) && pos.y >= f.position.y && pos.y <= f.position.y + (f.height ?? 0));
    addBoxAt({ x: pos.x - 125, y: pos.y - 30 }, f ? (f.data as any).groupId : undefined);
  };

  return (
    <div className={'canvas' + (animating ? ' animating' : '')} onDoubleClick={onDoubleClick}>
      <ReactFlow
        nodes={allNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onNodeDragStop={(_, __, dragged) =>
          update((p) => {
            for (const d of dragged) {
              const b = ops.findBox(p, d.id);
              if (b) b.pos = { x: Math.round(d.position.x), y: Math.round(d.position.y) };
            }
          })
        }
        onSelectionChange={({ nodes: ns }) => useStore.getState().select(ns.filter((n) => n.type === 'box').map((n) => n.id))}
        onNodesDelete={(ns) => {
          const ids = ns.filter((n) => n.type === 'box').map((n) => n.id);
          if (ids.length) update((p) => ops.deleteBoxes(p, ids));
        }}
        onEdgesDelete={(es) => update((p) => es.forEach((e) => ops.connect(p, e.source, e.sourceHandle, null)))}
        onEdgeDoubleClick={(_, e) => {
          if (e.sourceHandle === 'next' || e.sourceHandle === 'call') update((p) => ops.toggleCall(p, e.source, e.sourceHandle));
          else useStore.getState().say('jump ↔ call 전환은 "다음으로" 선과 call 선에서만 돼요');
        }}
        onNodeDoubleClick={(e, n) => {
          if (n.type !== 'box') return;
          const part = (e.target as HTMLElement).closest('[data-part]')?.getAttribute('data-part') ?? null;
          editBox(n.id, part);
        }}
        onNodeClick={(_, n) => {
          if (n.type !== 'frame') return;
          const g = (n.data as any).groupId;
          useStore.getState().select(useStore.getState().project.nodes.filter((b) => b.group === g).map((b) => b.id));
        }}
        zoomOnDoubleClick={false}
        deleteKeyCode={['Delete']}
        multiSelectionKeyCode={['Control', 'Meta', 'Shift']}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background gap={24} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => (n.type === 'frame' ? 'transparent' : project.labels.find((g) => g.id === ops.findBox(project, n.id)?.group)?.color ?? '#ddd')}
          nodeStrokeColor="#94a3b8"
        />
      </ReactFlow>
      <div className="canvas-hint">빈 곳 더블클릭: 새 상자 · 상자 더블클릭: 글 쓰기 · 선을 빈 곳에 놓기: 새 상자로 연결 · 선 더블클릭: jump↔call · Shift+드래그: 여러 개 선택 · Delete: 삭제</div>
    </div>
  );
}
