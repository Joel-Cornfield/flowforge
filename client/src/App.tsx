import { useCallback } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import "./App.css";

// Data that each workflow can store
type WorkflowNodeData = {
  label: string,
  description: string,
};

// Custom node component for workflow steps 
function WorkflowNode({ data }: NodeProps<Node<WorkflowNodeData>>) {
  return (
    <div className="workflow-node">
      <Handle type="target" position={Position.Left} />

      <div className="node-content">
        <span className="node-label">{data.label}</span>
        <span className="node-description">{data.description}</span>
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}

// Tell React Flow which component to use for nodes
const nodeTypes = {
  workflowNode: WorkflowNode,
};

// Initial workflow
const initialNodes: Node<WorkflowNodeData>[] = [
  {
    id: "trigger-1",
    type: "workflowNode",
    position: { x : 100, y: 150 },
    data: {
      label: "Manual Trigger",
      description: "Starts the workflow",
    },
  },
  {
    id: "http-1",
    type: "workflowNode",
    position: { x: 420, y: 150 },
    data: {
      label: "HTTP Request",
      description: "Fetch data from an API",
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

  // Called when user connects two nodes
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((currentEdges) => 
        addEdge(connection, currentEdges)
      );
    },
    [setEdges]
  );

  // Add a new node to the canvas
  const addWorkFlowNode = useCallback(() => {
    const newNode: Node<WorkflowNodeData> = {
      id: crypto.randomUUID(),
      type: "workflowNode",
      position: {
        x: 150 + Math.random() * 300,
        y: 100 + Math.random() * 250,
      },
      data: {
        label: "New Step",
        description: "Configure this step later",
      },
    };
    
    setNodes((currentNodes) => [...currentNodes, newNode]);
  }, [setNodes]);

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
          <button
            className="secondary-button"
            onClick={addWorkFlowNode}
          >
            + Add Node
          </button>

          <button className="primary-button">
            Run Workflow
          </button>
        </div>
      </header>

      <main className="editor">
        <aside className="sidebar">
          <h2>Workflow Builder</h2>
          <p className="sidebar-description">
            Build automations by connecting steps
          </p>

          <div className="sidebar-section">
            <h3>Getting started</h3>
            <p>
              Drag nodes to move them. Connect the handles to define the workflow.
            </p>
          </div>

          <div className="sidebar-section">
            <h3>Workflow nodes</h3>

            <div className="node-legend">
              <span className="legend-dot trigger-dot" />
              <span>Manual Trigger</span>
            </div>

            <div className="node-legend">
              <span className="legend-dot http-dot" />
              <span>HTTP Request</span>
            </div>
          </div>

          <div className="sidebar-footer">
            <span className="status-dot" />
            Editor Ready
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
            fitView
            minZoom={0.2}
            maxZoom={2}
          >
            <Background gap={20} size={1} />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </section>
      </main>
    </div>
  );
}

export default App;