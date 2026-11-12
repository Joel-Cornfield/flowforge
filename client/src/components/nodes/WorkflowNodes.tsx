import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

export type WorkflowNodeData = {
    label: string;
    description: string;
    nodeType: "manualTrigger" | "httpRequest" | "logOutput";
    url?: string;
    method?: "GET" | "POST" | "PUT" | "DELETE";
    executionStatus?: "idle" | "running" | "success" | "failed";
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