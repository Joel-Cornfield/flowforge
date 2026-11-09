const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

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