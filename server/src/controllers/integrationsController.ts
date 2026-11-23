import { Request, Response, NextFunction } from "express";
import SwaggerParser from "@apidevtools/swagger-parser";
import { OpenAPIV3 } from "openapi-types";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

type HttpMethod =
    | "GET"
    | "POST"
    | "PUT"
    | "PATCH"
    | "DELETE"
    | "OPTIONS"
    | "HEAD"
    | "TRACE";

interface ApiEndpoint {
    method: HttpMethod;
    path: string;
    summary: string;
    operationId?: string;
    parameters?: unknown[];
    requestBody?: unknown;
    responses?: unknown;
}

// POST /api/integrations
// Save an API
export const saveAPI = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({
            error: "Invalid request body."
        });
    }

    const { name, specification } = req.body;

    if (typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ error: "Name must be a non-empty string." });
    }

    if (typeof specification !== "object" || specification === null || Array.isArray(specification)) {
        return res.status(400).json({ error: "Specification must be a valid object." });
    }

    try {
        const validatedSpec = await SwaggerParser.validate(specification) as OpenAPIV3.Document;

        const baseUrl = validatedSpec.servers?.[0]?.url;

        if (!baseUrl) {
            return res.status(400).json({
                error: "OpenAPI specification must define at least one server URL."
            });
        }

        const endpoints: ApiEndpoint[] = [];

        const HTTP_METHODS = [
            "get", "put", "post", "delete", "options", "head", "patch", "trace",
        ] as const;

        if (validatedSpec.paths) {
            for (const [path, pathItem] of Object.entries(validatedSpec.paths)) {
                if (!pathItem) continue;

                for (const method of HTTP_METHODS) {
                    const operation = pathItem[method] // OperationObject | undefined
                    if (!operation) continue;
                    endpoints.push({
                        method: method.toUpperCase() as HttpMethod,
                        path: path,
                        summary: operation.summary ?? "No summary provided"
                    });
                }
            }
        }

        const api = await prisma.apiIntegration.create({
            data: {
                name: name.trim(),
                baseUrl,
                specification: specification as Prisma.InputJsonValue
            }
        });

        return res.status(201).json({
            api,
            endpoints,
        });
    } catch (error) {
        next(error);
    }
}

// GET /api/integrations 
// Retrieve all APIs
export const getAPIs = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const apis = await prisma.apiIntegration.findMany({
            orderBy: {
                createdAt: "desc",
            }
        });

        return res.status(200).json({
            apis,
        });
    } catch (error) {
       next(error); 
    }
}

// GET /api/integrations/:id
// Retrieve a specific API 
export const getAPI = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
) => {
    try {
        const api = await prisma.apiIntegration.findUnique({
            where: {
                id: req.params.id,
            }
        });

        if (!api) {
            return res.status(404).json({
                error: "API integration not found."
            });
        }

        return res.status(200).json({
            api,
        });
    } catch (error) {
       next(error);
    }
}

// DELETE /api/integrations/:id
// Delete an API
export const deleteAPI = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
) => {
    try {
        const exists = await prisma.apiIntegration.findUnique({
            where: {
                id: req.params.id,
            }
        });

        if (!exists) {
            return res.status(404).json({
                error: "API integration not found."
            });
        }

        await prisma.apiIntegration.delete({
            where: {
                id: req.params.id,
            }
        });

        return res.status(204).send();
    } catch (error) {
        next(error);
    }
}