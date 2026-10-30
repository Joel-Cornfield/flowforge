import { useCallback, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import "./App.css";
import { ManualTriggerNode, HttpRequestNode, LogOutputNode, type WorkflowNodeData } from "./components/nodes/WorkflowNodes";
import NodeConfigPanel from "./components/panels/NodeConfigPanel";

// Initial workflow
const initialNodes: Node<WorkflowNodeData>[] = [
  {
    id: "trigger-1",
    type: "manualTrigger",
    position: { x : 100, y: 150 },
    data: {
      label: "Manual Trigger",
      description: "Starts the workflow",
      nodeType: "manualTrigger",
    },
  },
  {
    id: "http-1",
    type: "httpRequest",
    position: { x: 420, y: 150 },
    data: {
      label: "Fetch Data",
      description: "Fetch data from an API",
      nodeType: "httpRequest",
      method: "GET",
      url: "https://jsonplaceholder.typicode.com/todos/1",
    },
  },
];

const initialEdges: Edge[] = [
  {
    id: "trigger-to-http",
    source: "trigger-1",
    target: "http-1",
    animated: true,
  },
];

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<WorkflowNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showNodeMenu, setShowNodeMenu] = useState(false);

  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      manualTrigger: ManualTriggerNode,
      httpRequest: HttpRequestNode,
      logOutput: LogOutputNode,
    }),
    []
  );

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;

  // Add a connection between two nodes
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((currentEdges) => 
        addEdge(
          {
            ...connection,
            animated: true,
          },
          currentEdges
        )
      );
    },
    [setEdges]
  );

  // Create new node of the requested type
  const addWorkFlowNode = useCallback(
    (
      nodeType: WorkflowNodeData["nodeType"]
    ) => {
      // Maps every available workflow node type to its corresponding default configuration object.
      const defaults: Record<
        WorkflowNodeData["nodeType"],
        WorkflowNodeData
      > = {
        manualTrigger: {
          label: "Manual Trigger",
          description: "Starts the workflow",
          nodeType: "manualTrigger",
        },
        httpRequest: {
          label: "HTTP Request",
          description: "Fetch data from an API",
          nodeType: "httpRequest",
          method: "GET",
          url: "",
        },
        logOutput: {
          label: "Log Output",
          description: "Displays step output",
          nodeType: "logOutput",
        },
      };
      const newNode: Node<WorkflowNodeData> = {
        id: crypto.randomUUID(),
        type: nodeType,
        position: {
          x: 120 + Math.random() * 200,
          y: 100 + Math.random() * 250,
        },
        data: { ...defaults[nodeType] },
      };

      setNodes((currentNodes) => [...currentNodes, newNode]);

      setSelectedNodeId(newNode.id);
      setShowNodeMenu(false);
    }, 
    [setNodes]
);

// Update a node's configuration without replacing other fields
const updateNode = useCallback(
  (
    nodeId: string,
    updates: Partial<WorkflowNodeData>
  ) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => 
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                ...updates,
              },
          } : node
      )
    );
  },
  [setNodes]
);

// Remove a node and all connections attached to it
const deleteNode = useCallback(
  (
    nodeId: string,
  ) => {
    setNodes((currentNodes) => 
      currentNodes.filter((node) => node.id !== nodeId)
    );

    setEdges((currentEdges) =>
      currentEdges.filter(
        (edge) => 
          edge.source !== nodeId && edge.target !== nodeId
      )
    );

    setSelectedNodeId(null);
  },
  [setNodes, setEdges]
);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">F</span>
          <span>FlowForge</span>
        </div>

        <div className="workflow-title">
          My First Workflow
        </div>

        <div className="topbar-actions">
          <div className="add-node-wrapper">
            <button 
              className="secondary-button"
              onClick={() => 
                setShowNodeMenu((visible) => !visible)
              }
            >
                + Add Node
            </button>

            {showNodeMenu && (
              <div className="node-menu">
                <button
                  onClick={() => 
                    addWorkFlowNode("manualTrigger")
                  }
                >
                  <span className="menu-dot trigger-dot" />
                  Manual Trigger
                </button>
                <button
                  onClick={() => 
                    addWorkFlowNode("httpRequest")
                  }
                >
                  <span className="menu-dot trigger-dot" />
                  HTTP Request
                </button>
                <button
                  onClick={() => 
                    addWorkFlowNode("logOutput")
                  }
                >
                  <span className="menu-dot trigger-dot" />
                  Log Output
                </button>
              </div>
            )}
          </div>

          <button 
            className="primary-button"
            onClick={() =>
              alert(
                "Workflow execution not implemented yet..."
              )
            }
          >
            Run Workflow
          </button>
        </div>
      </header>

      <main className="editor">
        <aside className="sidebar">
          <h2>Workflow Builder</h2>

          <p className="sidebar-description">
              Build automations by connecting steps.
          </p>

          <div className="sidebar-section">
              <h3>Getting started</h3>

              <p>
                  Add nodes, connect their handles and
                  select a node to configure it.
              </p>
          </div>

          <div className="sidebar-section">
              <h3>Available nodes</h3>

              <div className="node-legend">
                  <span className="legend-dot trigger-dot" />
                  <span>Manual Trigger</span>
              </div>

              <div className="node-legend">
                  <span className="legend-dot http-dot" />
                  <span>HTTP Request</span>
              </div>

              <div className="node-legend">
                  <span className="legend-dot log-dot" />
                  <span>Log Output</span>
              </div>
          </div>

          <div className="sidebar-footer">
              <span className="status-dot" />
              Editor ready
          </div>
      </aside>

        <section className="canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => 
              setSelectedNodeId(node.id)
            }
            onPaneClick={() => setSelectedNodeId(null)}
            fitView
            minZoom={0.2}
            maxZoom={2}
          >
            <Background gap={20} size={1} />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </section>

        <NodeConfigPanel
          node={selectedNode}
          onUpdate={updateNode}
          onDelete={deleteNode}
        />
      </main>
    </div>
  );
}

export default App;