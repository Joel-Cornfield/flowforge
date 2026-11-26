import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

export type ApiParameterConfig = {
    name: string;
    in: "path" | "query" | "header" | "cookie";
    required?: boolean;
    description?: string;
    schema?: unknown;
    example?: unknown;
    deprecated?: boolean;
    style?: string;
    explode?: boolean;
};

export type ApiEndpointConfig = {
    integrationId: string;
    integrationName: string;
    baseUrl: string;
    path: string;
    method: string;
    operationId?: string;
    summary?: string;
    description?: string;
    parameters: ApiParameterConfig[];
    requestBody?: unknown;
    security?: Array<Record<string, string[]>>;
    responses: Record<string, unknown>;
};

export type WorkflowNodeData = {
    label: string;
    description: string;
    nodeType: "manualTrigger" | "httpRequest" | "logOutput";
    url?: string;
    method?: string;
    executionStatus?: "idle" | "running" | "success" | "failed";
    // Full config imported from an OpenAPI endpoint
    apiEndpoint?: ApiEndpointConfig;
}

function NodeShell({
    children,
    color,
    status= "idle",
}: {
    children: React.ReactNode;
    color: string;
    status?: WorkflowNodeData["executionStatus"];
}) {
    return (
        <div className={`workflow-node ${status}`}>
            <Handle
                type="target"
                position={Position.Left}
                className="workflow-handle"
            />

            <div 
                className="node-accent"
                style={{ backgroundColor: color }}
            />

            {children}

            <Handle
                type="source"
                position={Position.Right}
                className="workflow-handle"
            />
        </div>
    );
}

export function ManualTriggerNode({
    data,
}: NodeProps<Node<WorkflowNodeData>>) {
    return (
        <NodeShell color="#a78bfa" status={data.executionStatus}>
            <div className="node-content">
                <span className="node-type">TRIGGER</span>
                <span className="node-label">{data.label}</span>
                <span className="node-description">{data.description}</span>
            </div>
        </NodeShell> 
    );
}

export function HttpRequestNode({
    data,
}: NodeProps<Node<WorkflowNodeData>>) {
    return (
        <NodeShell color="#38bdf8" status={data.executionStatus}>
            <div className="node-content">
                <span className="node-type">INTEGRATION</span>
                <span className="node-label">{data.label}</span>
                <span className="node-description">
                    {data.method ?? "GET"} ·{" "}
                    {data.url || "No URL configured"}
                </span>
            </div>
        </NodeShell>
    );
}

export function LogOutputNode({
    data,
}: NodeProps<Node<WorkflowNodeData>>) {
    return (
        <NodeShell color="#34d399" status={data.executionStatus}>
            <div className="node-content">
                <span className="node-type">OUTPUT</span>
                <span className="node-label">{data.label}</span>
                <span className="node-description">{data.description}</span>
            </div>
        </NodeShell> 
    );
}