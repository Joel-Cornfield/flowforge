import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useLocation, useNavigate } from "react-router";

import "@xyflow/react/dist/style.css";
import "../App.css";
import {
  ManualTriggerNode,
  HttpRequestNode,
  LogOutputNode,
  type WorkflowNodeData,
  type ApiEndpointConfig,
} from "../components/nodes/WorkflowNodes";

import NodeConfigPanel from "../components/panels/NodeConfigPanel";
import {
  createWorkflow,
  getWorkflow,
  getWorkflows,
  updateWorkflow,
  type WorkflowSummary,
  type ExecutionResult,
  type ExecutionEvent,
  executeWorkflowStream,
} from "../lib/workflowApi";

// No default workflow: the editor starts empty until a workspace is created.
const initialNodes: Node<WorkflowNodeData>[] = [];

const initialEdges: Edge[] = [];

const ACTIVE_WORKFLOW_STORAGE_KEY = "flowforge:open-workflow";

interface ActiveWorkflowSnapshot {
  workflowId: string | null;
  workflowName: string;
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  hasActiveWorkspace: boolean;
}

function readActiveWorkflowSnapshot(): ActiveWorkflowSnapshot | null {
  const stored = sessionStorage.getItem(ACTIVE_WORKFLOW_STORAGE_KEY);

  if (!stored) return null;

  try {
    const snapshot = JSON.parse(stored) as Partial<ActiveWorkflowSnapshot>;

    if (!Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges)) {
      return null;
    }

    return {
      workflowId:
        typeof snapshot.workflowId === "string" ? snapshot.workflowId : null,
      workflowName:
        typeof snapshot.workflowName === "string"
          ? snapshot.workflowName
          : "",
      nodes: snapshot.nodes as Node<WorkflowNodeData>[],
      edges: snapshot.edges as Edge[],
      hasActiveWorkspace:
        typeof snapshot.hasActiveWorkspace === "boolean"
          ? snapshot.hasActiveWorkspace
          : false,
    };
  } catch {
    return null;
  }
}

function WorkflowEditor() {
  const initialSnapshot = useMemo(() => readActiveWorkflowSnapshot(), []);

  const [nodes, setNodes, onNodesChange] =
    useNodesState<Node<WorkflowNodeData>>(initialSnapshot?.nodes ?? initialNodes);

  const [edges, setEdges, onEdgesChange] =
    useEdgesState<Edge>(initialSnapshot?.edges ?? initialEdges);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showNodeMenu, setShowNodeMenu] = useState(false);

  // Workflow persistence state
  const [hasActiveWorkspace, setHasActiveWorkspace] = useState(
    initialSnapshot?.hasActiveWorkspace ?? false
  );
  const [workflowId, setWorkflowId] = useState<string | null>(
    initialSnapshot?.workflowId ?? null
  );
  const [workflowName, setWorkflowName] = useState(
    initialSnapshot?.workflowName ?? ""
  );
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] =
    useState<ExecutionResult | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  // Capture the endpoint passed through navigation.
  // useRef prevents it being processed more than once.
  const incomingEndpointRef = useRef(
    (
      location.state as {
        apiEndpoint?: ApiEndpointConfig;
      } | null
    )?.apiEndpoint ?? null
  );

  const selectedNode =
    nodes.find((node) => node.id === selectedNodeId) ?? null;

  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      manualTrigger: ManualTriggerNode,
      httpRequest: HttpRequestNode,
      logOutput: LogOutputNode,
    }),
    []
  );

  // Clear notifications after five seconds.
  useEffect(() => {
    if (!error && !statusMessage) return;

    const timer = setTimeout(() => {
      setError(null);
      setStatusMessage("");
    }, 5000);

    return () => clearTimeout(timer);
  }, [error, statusMessage]);

  // Reset execution statuses on all nodes.
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
  }, [setNodes]);

  // Update an individual node's execution status.
  const setNodeExecutionStatus = useCallback(
    (
      nodeId: string,
      executionStatus: WorkflowNodeData["executionStatus"]
    ) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  executionStatus,
                },
              }
            : node
        )
      );
    },
    [setNodes]
  );

  // Receive execution events from the backend.
  const receiveEvent = useCallback(
    (result: ExecutionEvent) => {
      setNodeExecutionStatus(result.nodeId, result.status);
    },
    [setNodeExecutionStatus]
  );

  // Handle completed workflow execution.
  const completeExecution = useCallback((result: ExecutionResult) => {
    setExecutionResult(result);
    setIsVisible(true);

    if (result.status === "success") {
      setStatusMessage("Workflow executed successfully.");
    } else {
      setStatusMessage(result.error ?? "Workflow execution failed.");
    }
  }, []);

  // Add an API endpoint to the active workflow workspace.
  const addIntegrationEndpoint = useCallback(
    async (endpoint: ApiEndpointConfig) => {
      if (!hasActiveWorkspace) {
        setError("Create a workflow workspace with + New before adding endpoints.");
        return;
      }

      setIsLoading(true);
      setError(null);
      setStatusMessage("");

      try {
        const alreadyExists = nodes.some(
          (node) =>
            node.data.apiEndpoint?.integrationId === endpoint.integrationId &&
            node.data.apiEndpoint?.path === endpoint.path &&
            node.data.apiEndpoint?.method === endpoint.method
        );

        if (alreadyExists) {
          const existingNode = nodes.find(
            (node) =>
              node.data.apiEndpoint?.integrationId === endpoint.integrationId &&
              node.data.apiEndpoint?.path === endpoint.path &&
              node.data.apiEndpoint?.method === endpoint.method
          );

          setSelectedNodeId(existingNode?.id ?? null);
          setStatusMessage("This endpoint is already in the current workflow.");
          return;
        }

        const newNode: Node<WorkflowNodeData> = {
          id: crypto.randomUUID(),
          type: "httpRequest",
          position: {
            x: 420 + Math.max(0, nodes.length - 1) * 300,
            y: 150,
          },
          data: {
            label:
              endpoint.summary ??
              endpoint.operationId ??
              `${endpoint.method} ${endpoint.path}`,
            description:
              endpoint.description ??
              `${endpoint.method} request from ${endpoint.integrationName}`,
            nodeType: "httpRequest",
            method: endpoint.method,
            url: `${endpoint.baseUrl.replace(/\/$/, "")}${endpoint.path}`,
            apiEndpoint: endpoint,
          },
        };

        const updatedNodes = [...nodes, newNode];

        setNodes(updatedNodes);
        setSelectedNodeId(newNode.id);

        setExecutionResult(null);
        setIsVisible(false);

        const updatedWorkflows = await getWorkflows();
        setWorkflows(updatedWorkflows);

        setStatusMessage(
          `Added ${endpoint.method} ${endpoint.path} to the current workflow.`
        );
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to add endpoint to workflow."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [nodes, edges, workflowId, workflowName, setNodes, setEdges]
  );

  // Process an endpoint passed from IntegrationDetails.
  useEffect(() => {
    const endpoint = incomingEndpointRef.current;

    if (!endpoint) return;

    // Clear the ref before starting asynchronous work.
    // This prevents duplicate processing.
    incomingEndpointRef.current = null;

    void addIntegrationEndpoint(endpoint);

    // Clear navigation state so refreshing does not add the endpoint again.
    navigate("/", {
      replace: true,
      state: null,
    });
  }, [addIntegrationEndpoint, navigate]);

  // Load a saved workflow from the database.
  const loadWorkflow = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setError(null);
      setStatusMessage("");

      try {
        const workflow = await getWorkflow(id);

        setHasActiveWorkspace(true);
        setWorkflowId(workflow.id);
        setWorkflowName(workflow.name);
        setNodes(workflow.nodes as Node<WorkflowNodeData>[]);
        setEdges(workflow.edges as Edge[]);
        setSelectedNodeId(null);

        setStatusMessage("Workflow loaded successfully.");
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

  // Fetch saved workflows when the editor starts.
  useEffect(() => {
    let cancelled = false;

    const initialiseWorkflows = async () => {
      setIsLoading(true);

      try {
        const savedWorkflows = await getWorkflows();

        if (cancelled) return;

        setWorkflows(savedWorkflows);

        // Users choose a saved workflow or press + New.
      } catch (error) {
        if (!cancelled) {
          setError(
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

    void initialiseWorkflows();

    return () => {
      cancelled = true;
    };
  }, [setNodes, setEdges]);

  // Keep the open workflow state across routes such as the integrations page.
  useEffect(() => {
    sessionStorage.setItem(
      ACTIVE_WORKFLOW_STORAGE_KEY,
      JSON.stringify({
        workflowId,
        workflowName,
        nodes,
        edges,
        hasActiveWorkspace,
      })
    );
  }, [workflowId, workflowName, nodes, edges]);

  // Save the current workflow.
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
      setHasActiveWorkspace(true);

      const updatedWorkflows = await getWorkflows();
      setWorkflows(updatedWorkflows);

      setStatusMessage("Workflow saved successfully.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to save workflow."
      );
    } finally {
      setIsSaving(false);
    }
  }, [workflowId, workflowName, nodes, edges]);

  // Save and execute the current workflow.
  const runWorkflow = useCallback(async () => {
    setIsExecuting(true);
    setError(null);
    setStatusMessage("");
    setExecutionResult(null);
    resetExecutionStatuses();

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
      setHasActiveWorkspace(true);

      const updatedWorkflows = await getWorkflows();
      setWorkflows(updatedWorkflows);

      await executeWorkflowStream(
        savedWorkflow.id,
        receiveEvent,
        completeExecution
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to execute workflow."
      );
    } finally {
      setIsExecuting(false);
    }
  }, [
    workflowId,
    workflowName,
    nodes,
    edges,
    resetExecutionStatuses,
    receiveEvent,
    completeExecution,
  ]);

  // Create a new blank workflow.
  const createNewWorkflow = useCallback(() => {
    setHasActiveWorkspace(true);
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

  // Add a connection between two nodes.
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

  // Create a new node of the requested type.
  const addWorkFlowNode = useCallback(
    (nodeType: WorkflowNodeData["nodeType"]) => {
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

  // Update a node's configuration.
  const updateNode = useCallback(
    (nodeId: string, updates: Partial<WorkflowNodeData>) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  ...updates,
                },
              }
            : node
        )
      );
    },
    [setNodes]
  );

  // Delete a node and its connected edges.
  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((currentNodes) =>
        currentNodes.filter((node) => node.id !== nodeId)
      );

      setEdges((currentEdges) =>
        currentEdges.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId
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
          {hasActiveWorkspace && (
            <input
              type="text"
              value={workflowName}
              onChange={(event) => setWorkflowName(event.target.value)}
              maxLength={100}
              aria-label="Workflow name"
            />
          )}
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
              onClick={() => setShowNodeMenu((visible) => !visible)}
              disabled={!hasActiveWorkspace}
            >
              + Add Node
            </button>

            {showNodeMenu && (
              <div className="node-menu">
                <button onClick={() => addWorkFlowNode("manualTrigger")}>
                  <span className="menu-dot trigger-dot" />
                  Manual Trigger
                </button>

                <button onClick={() => addWorkFlowNode("httpRequest")}>
                  <span className="menu-dot http-dot" />
                  HTTP Request
                </button>

                <button onClick={() => addWorkFlowNode("logOutput")}>
                  <span className="menu-dot log-dot" />
                  Log Output
                </button>
              </div>
            )}
          </div>

          <button
            className="primary-button"
            onClick={() => void saveCurrentWorkflow()}
            disabled={
              !hasActiveWorkspace ||
              isSaving ||
              isLoading ||
              !workflowName.trim()
            }
          >
            {isSaving ? "Saving..." : "Save Workflow"}
          </button>

          <button
            className="primary-button"
            onClick={() => void runWorkflow()}
            disabled={
              !hasActiveWorkspace ||
              isExecuting ||
              isSaving ||
              isLoading ||
              !workflowName.trim()
            }
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
            <button
              type="button"
              className="close-btn"
              aria-label="Close"
              onClick={() => {
                setIsVisible(false);
                resetExecutionStatuses();
              }}
            />

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
                : "Failed"}
            </span>
          </div>

          {executionResult.error && (
            <p className="error-message">{executionResult.error}</p>
          )}

          <div className="execution-node-list">
            {executionResult.nodeResults.map((result, index) => (
              <div
                className="execution-node"
                key={`${result.nodeId}-${index}`}
              >
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
              Add nodes, connect their handles and select a node to configure
              it.
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
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
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

export default WorkflowEditor;
