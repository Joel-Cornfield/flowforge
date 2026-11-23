import { request } from "./workflowApi";

export interface ApiIntegration {
    id: string,
    name: string,
    baseUrl: string,
    specification: Record<string, unknown>,
    createdAt: string,
    updatedAt: string,
};

interface GetAPIsResponse {
    apis: ApiIntegration[];
}

export async function getAPIs(): Promise<ApiIntegration[]> {
    const data = await request<GetAPIsResponse>("/integrations");
    return data.apis;
}

export async function getAPI(id: string): Promise<ApiIntegration> {
    return request<ApiIntegration>(`/integrations/${id}`);
}
/*
export async function saveAPI(data: ApiIntegration): Promise<> {
    return request<>("/integrations", {
        method: "POST",
        body: JSON.stringify(data),
    });
}
*/
export async function deleteAPI(id: string): Promise<void> {
    return request<void>(`/integrations/${id}`, {
        method: "DELETE",
    });
}