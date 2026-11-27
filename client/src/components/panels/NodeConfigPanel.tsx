import type { Node } from "@xyflow/react";
import type { WorkflowNodeData, ApiParameterConfig } from "../nodes/WorkflowNodes";

type NodeConfigPanelProps = {
    node: Node<WorkflowNodeData> | null;
    onUpdate: (
        nodeId: string,
        updates: Partial<WorkflowNodeData>
    ) => void;
    onDelete: (nodeId: string) => void;
};


// Turns any value into a string you can show inside a <pre>
function formatJson(value: unknown) {
    if (value === undefined || value === null) {
        return "Not specified";
    }

    if (typeof value === "string") {
        return value;
    }

    return JSON.stringify(value, null, 2);
}


// Finds an example value for an API parameter
function getParameterExample(parameter: ApiParameterConfig) {
    if (parameter.example !== undefined) {
        return parameter.example;
    }

    if (parameter.schema && typeof parameter.schema === "object" && "example" in parameter.schema) {
        return parameter.schema.example;
    }

    return undefined;
}

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
    const endpoint = data.apiEndpoint;
    const parameterLocations = ["path", "query", "header", "cookie"] as const; 
    // `as const` makes this a tuple of literal types instead of string[] (matters when you compare it against parameter.in)

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
                    <div className="config-section">
                        <h3>Request</h3>

                        {endpoint && (
                            <p className="field-hint">
                                Imported from {endpoint.integrationName}
                            </p>
                        )}

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
                        </div>

                        {endpoint && (
                            <>
                                <div className="config-field">
                                    <label>Base URL</label>
                                    <code>{endpoint.baseUrl}</code>
                                </div>

                                <div className="config-field">
                                    <label>Endpoint Path</label>
                                    <code>{endpoint.path}</code>
                                </div>

                                {endpoint.operationId && (
                                    <div className="config-field">
                                        <label>Operation ID</label>
                                        <code>{endpoint.operationId}</code>
                                    </div>
                                )}

                                {endpoint.description && (
                                    <div className="config-field">
                                        <label>Description</label>
                                        <code>{endpoint.description}</code>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Parameters */}
                    {endpoint && (
                        <div className="config-section">
                            <h3>Parameters</h3>

                            {endpoint.parameters.length === 0 ? (
                                <p className="config-help">
                                    This endpoint has no parameters.
                                </p>
                            ) : (
                                parameterLocations.map((location) => {
                                    const parameters = 
                                        endpoint.parameters.filter(
                                            (parameter) => parameter.in === location
                                        );

                                    if (parameters.length === 0) {
                                        return null;
                                    }

                                    return (
                                        <div className="config-subsection" key={location}>
                                            <h4>{location.charAt(0).toUpperCase() + location.slice(1)}</h4>

                                            {parameters.map((parameter) => (
                                                <div className="config-detail" key={`${parameter.in}-${parameter.name}`}>
                                                    <div className="config-detail-header">
                                                        <strong>{parameter.name}</strong>
                                                        <span>{parameter.required ? "Required" : "Optional"}</span>
                                                    </div>
                                                    {parameter.description && (
                                                        <p>{parameter.description}</p>
                                                    )}
                                                    {parameter.deprecated && (
                                                        <p className="field-hint">Deprecated</p>
                                                    )}
                                                    <p className="field-hint">
                                                        Type: {
                                                            parameter.schema &&
                                                            typeof parameter.schema === "object" && 
                                                            "type" in parameter.schema
                                                                ? String(parameter.schema.type)
                                                                : "Not specified"
                                                        }
                                                    </p>
                                                    {getParameterExample(parameter) !== undefined} && (
                                                        <pre>
                                                            {formatJson(getParameterExample(parameter))}
                                                        </pre>
                                                    )
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Request body */}
            {endpoint?.requestBody !== undefined && (
                <div className="config-section">
                    <h3>Request Body</h3>
                    <pre>{formatJson(endpoint.requestBody)}</pre>
                </div>
            )}

            {/* Authentication */}
            {endpoint && (
                <div className="config-section">
                    <h3>Authentication</h3>

                    {endpoint.security && endpoint.security.length > 0 ? (
                        <pre>{formatJson(endpoint.security)}</pre>
                    ) : (
                        <p className="config-help">No security requirements.</p>
                    )}
                </div>
            )}
            
            {/* Responses */}
            {endpoint && (
                <div className="config-section">
                    <h3>Responses</h3>
                    {Object.keys(endpoint.responses).length === 0 ? (
                        <p className="config-help">No response definitions.</p>
                    ) : (
                        Object.entries(endpoint.responses).map(([status, response]) => (
                            <div className="config-detail" key={status}>
                                <strong>{status}</strong>
                                {response && typeof response === "object" && "description" in response ? (
                                    <p>{String(response.description)}</p>
                                ) : null}

                                <details>
                                    <summary>View response details</summary>

                                    <pre>{formatJson(response)}</pre>
                                </details>
                            </div>
                        ))
                    )}
                </div>
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