import React, { useMemo } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Edge,
  Node,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

interface Character {
  id: string;
  name: string;
  role: string;
  personality: string[];
  abilities: { name: string; level: number }[];
  currentState?: string;
  relationships?: { characterId: string; relation: string }[];
}

export default function RelationshipGraph({
  characters,
}: {
  characters: Character[];
}) {
  const initialNodes: Node[] = useMemo(() => {
    if (!characters || characters.length === 0) return [];
    const radius = Math.max(200, characters.length * 30);
    const center = { x: radius + 100, y: radius + 100 };
    return characters.map((c, i) => {
      const angle = (2 * Math.PI * i) / characters.length;
      return {
        id: c.id,
        data: { label: c.name },
        position: {
          x: center.x + radius * Math.cos(angle),
          y: center.y + radius * Math.sin(angle),
        },
        style: {
          background: c.role === "主角" ? "#f3e8ff" : "#fff",
          border: "1px solid #d8b4fe",
          borderRadius: "8px",
          padding: "10px 20px",
          fontWeight: "bold",
          color: "#6b21a8",
        },
      };
    });
  }, [characters]);

  const initialEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];
    if (!characters) return edges;
    const characterIds = new Set(characters.map((c) => c.id));
    characters.forEach((c) => {
      c.relationships?.forEach((r) => {
        if (characterIds.has(r.characterId)) {
          edges.push({
            id: `e-${c.id}-${r.characterId}`,
            source: c.id,
            target: r.characterId,
            label: r.relation,
            type: "smoothstep",
            animated: true,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#a855f7",
            },
            style: { stroke: "#a855f7", strokeWidth: 2 },
            labelStyle: { fill: "#7e22ce", fontWeight: 600, fontSize: 12 },
            labelBgStyle: { fill: "rgba(255, 255, 255, 0.9)" },
            labelBgPadding: [4, 4],
            labelBgBorderRadius: 4,
          });
        }
      });
    });
    return edges;
  }, [characters]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  if (!characters || characters.length === 0) {
    return (
      <div className="flex items-center justify-center h-[600px] border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-900/50 text-gray-400">
        暂无人物数据，请先添加人物卡。
      </div>
    );
  }

  return (
    <div
      style={{ width: "100%", height: "600px" }}
      className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-900"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        attributionPosition="bottom-right"
        colorMode="system"
      >
        <Controls />
        <MiniMap
          zoomable
          pannable
          nodeColor={(n: any) => {
            return n.style?.background === "#f3e8ff" ? "#d8b4fe" : "#e5e7eb";
          }}
        />
        <Background gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
