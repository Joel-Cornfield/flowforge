import { parse } from "node:path";

type NodeType = "manualTrigger" | "httpRequest" | "logOutput";

interface WorkflowNode {
    id: string;
    type?: string;
    data: {
        nodeType?: NodeType;
        label?: string;
        url?: string;
        method?: string;
    };
}

interface WorkflowEdge {
    source: string;
    target: string;
}

interface NodeResult { // one per node run
    nodeId: string;
    nodeType: NodeType;
    status: "success" | "failed";
    output?: unknown;
    error?: string;
    durationMs: number;
}

interface ExecutionResult { // whole run
    status: "success" | "failed";
    startedAt: string;
    finishedAt: string;
    nodeResults: NodeResult[];
    error?: string;
}

function getNodeType(node: WorkflowNode): NodeType {
    const nodeType = node.data.nodeType ?? node.type;

    if (
        nodeType !== "manualTrigger" &&
        nodeType !== "httpRequest" &&
        nodeType !== "logOutput"
    ) {
        throw new Error(`Unsupported node type: ${nodeType ?? "unknown"}`)
    }

    return nodeType;
}

function getExecutionOrder(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
    if (nodes.length === 0) { 
        throw new Error("The workflow has no nodes.");
    }

    // nodeMap: Map<id, node>
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));

    if (nodeMap.size !== nodes.length) {
        throw new Error("The workflow contains duplicated node IDs.");
    }

    const triggers = nodes.filter((node) => getNodeType(node) === "manualTrigger");

    if (triggers.length !== 1) {
        throw new Error("A workflow must have exactly one Manual Trigger.");
    }

    // Map of each node's outgoing connections
    // outgoing: Map<sourceId, targetId[]>
    const outgoing = new Map<string, string[]>();

    for (const edge of edges) {
        if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) {
            throw new Error("An edge references a node that doesn't exist.");
        }

        const targets = outgoing.get(edge.source) ?? [];
        targets.push(edge.target);
        outgoing.set(edge.source, targets);
    }

    // Follow connections from manual trigger
    const orderedNodes: WorkflowNode[] = [];
    const visited = new Set<string>();

    let current: WorkflowNode | undefined = triggers[0];

    while (current) {
        if (visited.has(current.id)) {
            throw new Error("The workflow contains a cycle.");
        }
        visited.add(current.id);
        orderedNodes.push(current);

        const targets: string[] = outgoing.get(current.id) ?? [];

        if (targets.length > 1) {
            throw new Error("Branching not supported yet.");
        }

        current = targets.length === 1 
            ? nodeMap.get(targets[0])
            : undefined;
    }

    if (visited.size !== nodes.length) {
        throw new Error("Some nodes weren't reachable from the trigger.");
    }

    return orderedNodes;
}

async function executeNode(node: WorkflowNode, previousOutput: unknown): Promise<unknown> {
    const nodeType = getNodeType(node);

    switch (nodeType) {
        case "manualTrigger": 
            return {
                triggered: true,
                message: "Workflow started"
            };
        case "httpRequest": {
            const url = node.data.url;
            const method = (node.data.method ?? "GET").toUpperCase();
            
            if (!url) {
                throw new Error("HTTP Request node is missing a URL.");
            }

            if (!["GET", "POST", "PUT", "DELETE"].includes(method)) {
                throw new Error(`Unsupported method type: ${method}`);
            }

            const parsedUrl = new URL(url);

            if (!["http:", "https:"].includes(parsedUrl.protocol)) {
                throw new Error("Only HTTP and HTTPS URLs are supported");
            }

            // Basic protection against requests to local services
            const hostname = parsedUrl.hostname.toLowerCase();

            if (
                hostname === "localhost" ||
                hostname === "127.0.0.1" ||
                hostname === "::1" || 
                hostname.endsWith(".local") ||
                // matches a private range (10.x, 192.168.x, 172.16-31.x)
                /^10\./.test(hostname) || 
                /^192\.168\./.test(hostname) ||
                /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
            ) {
                throw new Error("Requests to local or private addresses are blocked.");
            }

            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 10000)

            try {
                const response = await fetch(parsedUrl, {
                    method,
                    headers:
                        method === "POST" || method === "PUT" || method === "PATCH"
                            ? { "Content-Type": "application/json" }
                            : undefined,
                    body: 
                        method === "POST" || method === "PUT" || method === "PATCH"
                            ? JSON.stringify(previousOutput)
                            : undefined,
                    signal: controller.signal,
                    redirect: "error",
                });

                const contentLength = Number(
                    response.headers.get("content-length") ?? 0
                );

                if (contentLength > 1_000_000) {
                    throw new Error("HTTP response is too large (1 MB limit).");
                }

                const text = await response.text();

                if (text.length > 1_000_000) {
                    throw new Error("HTTP response is too large (1 MB limit).");
                }

                let body: unknown = text;

                try {
                    body = text ? JSON.parse(text) : null;
                } catch {
                    body = text;
                }

                if (!response.ok) {
                    throw new Error(`HTTP request failed with status: ${response.status}.`)
                }

                return {
                    status: response.status,
                    body
                }
            } finally {
                clearTimeout(timeout);
            }
        }
        case "logOutput": 
            return previousOutput;
    }
}

export async function executeWorkflow(
    nodes: WorkflowNode[], 
    edges: WorkflowEdge[]
): Promise<ExecutionResult> {
    const startedAt = new Date();
    const nodeResults: NodeResult[] = [];

    try {
        const orderedNodes = getExecutionOrder(nodes, edges);
        let previousOutput: unknown = null;
        
        for (const node of orderedNodes) {
            const nodeType = getNodeType(node);
            const nodeStartedAt = Date.now();

            try {
                const output = await executeNode(node, previousOutput);
                nodeResults.push({
                    nodeId: node.id,
                    nodeType,
                    status: "success",
                    output,
                    durationMs: Date.now() - nodeStartedAt
                });

                previousOutput = output;
            } catch (error) {
                nodeResults.push({
                    nodeId: node.id,
                    nodeType,
                    status: "failed",
                    error: error instanceof Error 
                        ? error.message
                        : "An unexpected error occurred.",
                    durationMs: Date.now() - nodeStartedAt
                });

                throw error; // so outer catch stops run
            }
        }
        return {
            status: "success",
            startedAt: startedAt.toISOString(),
            finishedAt: new Date().toISOString(),
            nodeResults,
        }
    } catch (error) {
        return {
            status: "failed",
            startedAt: startedAt.toISOString(),
            finishedAt: new Date().toISOString(),
            nodeResults,
            error: error instanceof Error
                ? error.message
                : "Workflow execution failed.",
        };
    }
}
