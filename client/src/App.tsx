import { useCallback, useEffect, useMemo, useState } from "react";
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
import { 
  ManualTriggerNode, 
  HttpRequestNode, 
  LogOutputNode, 
  type WorkflowNodeData 
} from "./components/nodes/WorkflowNodes";

import NodeConfigPanel from "./components/panels/NodeConfigPanel";
import { createWorkflow, getWorkflow, getWorkflows, updateWorkflow, executeWorkflowById, type WorkflowSummary, type ExecutionResult } from "./lib/workflowApi";

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

  // Workflow persistence state 
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState("My First Workflow");
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!error && !statusMessage) return;

    // Timer to clear error/statusMessage after 5 sec
    const timer = setTimeout(() => {
      setError(null);
      setStatusMessage("");
    }, 5000);

    // Cleanup function to clear the timeout if the component unmounts
    // or if `error` or 'statusMessage' changes before the timer finishes
    return () => clearTimeout(timer);
  }, [error, statusMessage]);


  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      manualTrigger: ManualTriggerNode,
      httpRequest: HttpRequestNode,
      logOutput: LogOutputNode,
    }),
    []
  );

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;

  const resetExecutionStatuses = useCallback(() => {
    setNodes((currentNodes) => 
      currentNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          executionStatus: "idle",
        },
      }))
    );
  },[setNodes]);

  const setNodeExecutionStatus = useCallback(
    (nodeId: string, executionStatus: WorkflowNodeData["executionStatus"]) => {
      setNodes((currentNodes) => 
        currentNodes.map((node) => 
          node.id === nodeId 
            ? {
              ...node, 
              data: {
                ...node.data,
                executionStatus,
              }
            }
            : node
        )
      )
  },
  [setNodes]
);

  // Load workflow from API
  const loadWorkflow = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setError(null);
      setStatusMessage("");

      try {
        const workflow = await getWorkflow(id);

        setWorkflowId(workflow.id);
        setWorkflowName(workflow.name);
        setNodes(workflow.nodes as Node<WorkflowNodeData>[]); // API returns unknown[], so have to cast to Node<WorkflowNodeData>[]
        setEdges(workflow.edges as Edge[]);
        setSelectedNodeId(null);
        setStatusMessage("Workflow loaded successfully");
        resetExecutionStatuses();
        setIsVisible(false);
      } catch (error) {
        setError(
          error instanceof Error 
          ? error.message 
          : "Failed to load workflow."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [setNodes, setEdges, resetExecutionStatuses]
  );

  // Fetch saved workflows when application starts 
  useEffect(() => {
    let cancelled = false;
    
    const initialiseWorkflows = async () => {
      setIsLoading(true);
      
      try {
        const workflows = await getWorkflows();

        if (cancelled) return;

        setWorkflows(workflows);

        // Auto load most recently updated workflow
        if (workflows.length > 0) {
          const workflow = await getWorkflow(workflows[0].id);

          if (cancelled) return;

          setWorkflowId(workflow.id);
          setWorkflowName(workflow.name);
          setNodes(workflow.nodes as Node<WorkflowNodeData>[]);
          setEdges(workflow.edges as Edge[]);
        }
      } catch (error) {
        if (!cancelled) {
          setError (
            error instanceof Error
              ? error.message
              : "Failed to retrieve workflows."
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void initialiseWorkflows(); // void as we are not awaiting it in the effect

    return () => {
      cancelled = true
    };
  }, [setNodes, setEdges]);

  const saveCurrentWorkflow = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setStatusMessage("");

    try {
      const workflowData = {
        name: workflowName,
        nodes,
        edges,
      };

      const savedWorkflow = workflowId 
        ? await updateWorkflow(workflowId, workflowData)
        : await createWorkflow(workflowData);
      
      setWorkflowId(savedWorkflow.id);
      setWorkflowName(savedWorkflow.name);

      // Refresh saved workflow list 
      const workflows = await getWorkflows();
      setWorkflows(workflows);

      setStatusMessage("Workflows saved successfully");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to save workflow."
      )
    } finally {
      setIsSaving(false);
    }
  }, [workflowId, workflowName, nodes, edges]);

  const runWorkflow = useCallback(async () => {
    setIsExecuting(true);
    setError(null);
    setStatusMessage("");
    setExecutionResult(null);
    resetExecutionStatuses();
    setNodes((currentNodes) => 
      currentNodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          executionStatus: "running",
        },
      }))
    );

    try {
      // Save latest editor state before executing 
      const workflowData = {
        name: workflowName,
        nodes, 
        edges,
      };

      const savedWorkflow = workflowId 
        ? await updateWorkflow(workflowId, workflowData)
        : await createWorkflow(workflowData);

      setWorkflowId(savedWorkflow.id);
      setWorkflowName(savedWorkflow.name);

      const updatedWorkflows = await getWorkflows();
      setWorkflows(updatedWorkflows);

      // Execute saved version of workflow
      const result = await executeWorkflowById(savedWorkflow.id);

      for (const nodeResult of result.nodeResults) {
        setNodeExecutionStatus(nodeResult.nodeId, nodeResult.status);
      }

      setExecutionResult(result);
      setIsVisible(true);

      if (result.status === "success") {
        setStatusMessage("Workflow executed successfully.");
      } else {
        setStatusMessage(result.error ?? "Workflow execution failed.");
      }
    } catch (error) {
      setError(
        error instanceof Error 
          ? error.message
          : "Failed to execute workflow."
      );
    } finally {
      setIsExecuting(false);
    }
  }, [workflowId, workflowName, nodes, edges, resetExecutionStatuses, setNodeExecutionStatus]);

  // Create a new workflow
  const createNewWorkflow = useCallback(() => {
    setWorkflowId(null);
    setWorkflowName("Untitled Workflow");
    setNodes(initialNodes);
    setEdges(initialEdges);
    setSelectedNodeId(null);
    setError(null);
    setStatusMessage("New workflow created successfully.");
    setExecutionResult(null);
    setIsVisible(false);
  }, [setNodes, setEdges]);

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
          <input 
            type="text"
            value={workflowName}
            onChange={(event) => setWorkflowName(event.target.value)}
            maxLength={100}
            aria-label="Workflow name"
          />
        </div>

        <div className="topbar-actions">
          <button 
            className="secondary-button"
            onClick={createNewWorkflow}
            disabled={isLoading || isSaving}
          >
            + New
          </button>

          <select 
            className="workflow-select"
            value={workflowId ?? ""}
            onChange={(event) => {
              if (event.target.value) {
                void loadWorkflow(event.target.value);
              }
            }}
            disabled={isLoading || workflows.length === 0}
            aria-label="Load saved workflow"
          >
            {workflows.map((workflow) => (
              <option key={workflow.id} value={workflow.id}>
                {workflow.name}
              </option>
            ))}
          </select>

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
                  <span className="menu-dot http-dot" />
                  HTTP Request
                </button>
                <button
                  onClick={() => 
                    addWorkFlowNode("logOutput")
                  }
                >
                  <span className="menu-dot log-dot" />
                  Log Output
                </button>
              </div>
            )}
          </div>

          <button 
            className="primary-button"
            onClick={() => void saveCurrentWorkflow()}
            disabled={isSaving || isLoading || !workflowName.trim()}
          >
            {isSaving ? "Saving..." : "Save Workflow"}
          </button>

          <button 
            className="primary-button"
            onClick={() => void runWorkflow()}
            disabled={isExecuting || isSaving || isLoading || !workflowName.trim()}
          >
            {isExecuting ? "Running..." : "Run Workflow"}
          </button>
        </div>
      </header>

      {(error || statusMessage || isLoading) && (
        <div className="workflow-notification">
          {isLoading && <span>Loading workflow...</span>}

          {error && <span className="error-message">{error}</span>}

          {!error && statusMessage && <span>{statusMessage}</span>}
        </div>
      )}

      {executionResult && isVisible && (
        <section className="execution-panel">
          <div className="execution-header">
            <button type="button" className="close-btn" aria-label="Close" onClick={() => {setIsVisible(false); resetExecutionStatuses(); }}></button>

            <h3>Execution Results</h3>

            <span
              className={
                executionResult.status === "success"
                  ? "execution-success"
                  : "execution-failed"
              }
            >
              {executionResult.status === "success"
                ? "Successful"
                : "Failed"
              }
            </span>
          </div>

          {executionResult.error && (
            <p className="error-message">{executionResult.error}</p>
          )}

          <div className="execution-node-list">
            {executionResult.nodeResults.map((result, index) => (
              <div className="execution-node" key={`${result.nodeId}-${index}`}>
                <div className="execution-node-header">
                  <strong>{result.nodeType}</strong>

                  <span
                    className={
                      result.status === "success"
                        ? "execution-success"
                        : "execution-failed"
                    }
                  >
                    {result.status}
                  </span>
                </div>

                <p>Node ID: {result.nodeId || "Workflow"}</p>
                <p>Duration: {result.durationMs} ms</p>

                {result.error && (
                  <p className="error-message">{result.error}</p>
                )}

                {result.output !== undefined && (
                  <pre className="execution-output">
                    {JSON.stringify(result.output, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

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