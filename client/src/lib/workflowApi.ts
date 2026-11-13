const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

type NodeType = "manualTrigger" | "httpRequest" | "logOutput";

export interface Workflow<TNode = unknown, TEdge = unknown> { // The generics let the caller plug in their own node/edge types (unknown is default if not)
    id: string,
    name: string,
    nodes: TNode[],
    edges: TEdge[],
    createdAt: string,
    updatedAt: string,
}

export interface WorkflowSummary {
    id: string,
    name: string,
    createdAt: string,
    updatedAt: string,
}

// Sent for create/update
interface WorkflowInput<TNode = unknown, TEdge = unknown> {
    name: string,
    nodes: TNode[],
    edges: TEdge[],
}

interface NodeResult { // one per node run
    nodeId: string;
    nodeType: NodeType
    status: "success" | "failed";
    output?: unknown;
    error?: string;
    durationMs: number;
}

export interface ExecutionResult { // whole run
    status: "success" | "failed";
    startedAt: string;
    finishedAt: string;
    nodeResults: NodeResult[];
    error?: string;
}

export interface ExecutionEvent {
    nodeId: string;
    nodeType: NodeType;
    status: "running" | "success" | "failed";
    output?: unknown;
    error?: string;
    durationMs?: number;
}

async function request<T>( // Caller specifies what type of data expected back
    endpoint: string,
    options?: RequestInit
): Promise<T> {
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options?.headers, // After default so callers can override it 
        }, 
    });

    if (!response.ok) {
        // fetch does not throw on 4xx/5xx status
        const error = await response.json().catch(() => null); // catch invalid JSON

        throw new Error(
            error?.error ?? `Request failed (${response.status})`
        );
    }

    if (response.status === 204) { // DELETE returns no body
        return undefined as T;
    }

    return response.json() as Promise<T>;
}

// GET /workflows
export async function getWorkflows(): Promise<WorkflowSummary[]> {
    return request<WorkflowSummary[]>("/workflows");
}

// GET /workflows/:id
export async function getWorkflow(id: string): Promise<Workflow> {
    return request<Workflow>(`/workflows/${id}`)
}

// POST /workflows
export async function createWorkflow<TNode, TEdge>(data: WorkflowInput<TNode, TEdge>): Promise<Workflow<TNode, TEdge>> {
    return request<Workflow<TNode, TEdge>>("/workflows", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

// PUT /workflows/:id
export async function updateWorkflow<TNode, TEdge>(id: string, data: WorkflowInput<TNode, TEdge>): Promise<Workflow<TNode, TEdge>> {
    return request<Workflow<TNode, TEdge>>(`/workflows/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
    });
}

// DELETE /workflows/:id
export async function deleteWorkflow(id: string): Promise<void> {
    return request<void>(`/workflows/${id}`, {
        method: "DELETE",
    });
}

// POST /workflows/:id/execute/stream
export async function executeWorkflowStream(id: string, onEvent: (event: ExecutionEvent) => void, onComplete: (event: ExecutionResult) => void) {
    const response = await fetch(`${API_URL}/${id}/execute/stream`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        }, 
    });

    if (!response.ok) {
        // fetch does not throw on 4xx/5xx status
        const error = await response.json().catch(() => null); // catch invalid JSON

        throw new Error(
            error?.error ?? `Request failed (${response.status})`
        );
    }

    if (!response.body) {
        throw new Error(
            'No response body returned.'
        );
    }

    const reader = response.body.getReader();

    const decoder = new TextDecoder();

    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        // Decode + normalise incoming text 
        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, "\n"); 

        let index;

        // While buffer contains a complete message (messages end in \n\n)
        while ((index = buffer.indexOf("\n\n")) !== -1) {

            // Extract message
            const completedMessage = buffer.slice(0, index + 2);
        
            // Remove message from buffer
            buffer = buffer.slice(index + 2);

            let event = "message"; // Default if no SSE event present
            let data = "";

            for (const line of completedMessage.split("\n")) {
                if (line.startsWith("event:")) {
                    event = line.slice("event:".length).trim();
                } else if (line.startsWith("data:")) {
                    data = line.slice("data:".length).trim();
                }
            } 

            if (event === "node") {
                const result = JSON.parse(data);
                onEvent(result);
            }

            if (event === "complete") {
                const finalResult = JSON.parse(data)
                onComplete(finalResult);
            }

            if (event === "error") {
                const result = JSON.parse(data);
                throw new Error(result.message);
            }
        }
    } 
    // Flush the decoder
    buffer += decoder.decode();
}