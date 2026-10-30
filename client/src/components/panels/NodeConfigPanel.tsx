import type { Node } from "@xyflow/react";
import type { WorkflowNodeData } from "../nodes/WorkflowNodes";

type NodeConfigPanelProps = {
    node: Node<WorkflowNodeData> | null;
    onUpdate: (
        nodeId: string,
        updates: Partial<WorkflowNodeData>
    ) => void;
    onDelete: (nodeId: string) => void;
};

function NodeConfigPanel({
    node,
    onUpdate,
    onDelete,
}: NodeConfigPanelProps) {
    if (!node) {
        return (
            <aside className="config-panel">
                <h2>Node Configuration</h2>

                <p className="config-empty">
                    Select a node on the canvas to congifure it.
                </p>
            </aside>
        );
    }

    const data = node.data;

    return (
        <aside className="config-panel">
            <div className="config-header">
                <div>
                    <span className="config-eyebrow">
                        NODE SETTINGS
                    </span>
                    <h2>{data.label}</h2>
                </div>

                <button
                    className="delete-button"
                    onClick={() => onDelete(node.id)}
                    aria-label="Delete selected node"
                    title="Delete node"
                >
                    Delete
                </button>
            </div>

            <div className="config-field">
                <label htmlFor="node-label" className="node-label">Display Name</label>

                <input 
                    id="node-label"
                    value={data.label}
                    onChange={(event) => 
                        onUpdate(node.id, {
                            label: event.target.value,
                        })
                    }
                    maxLength={80}
                />
            </div>

            {data.nodeType === "httpRequest" && (
                <>
                    <div className="config-field">
                        <label htmlFor="http-method">
                            HTTP Method
                        </label>

                        <select
                            id="http-method"
                            value={data.method ?? "GET"}
                            onChange={(event) => {
                                onUpdate(node.id, {
                                    method: event.target.value as WorkflowNodeData["method"],
                                })
                            }}
                        >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                        </select>
                    </div>

                    <div className="config-field">
                        <label htmlFor="http-url">Request URL</label>

                        <input
                            id="http-url"
                            type="url"
                            placeholder="https://api.example.com/data"
                            value={data.url ?? ""}
                            onChange={(event) => {
                                onUpdate(node.id, {
                                    url: event.target.value,
                                })
                            }}
                        />

                        <span className="field-hint">
                            The endpoint this node will request.
                        </span>
                    </div>
                </>
            )}

            {data.nodeType === "manualTrigger" && (
                <p className="config-help">
                    This node starts the workflow when you run it manually.
                </p>
            )}

            {data.nodeType === "logOutput" && (
                <p className="config-help">
                    This node will display the output from the preceding step when workflow execution is implemented.
                </p>
            )}

            <div className="config-metadata">
                <span>Node ID</span>
                <code>{node.id}</code>
            </div>
        </aside>
    );
}

export default NodeConfigPanel;