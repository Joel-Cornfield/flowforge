import { Request, Response, NextFunction } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma"; 
import { z } from "zod";
import { executeWorkflow as execute, ExecutionEvent } from "../services/workflowExecutor";

// Define schema (runtime validator)
const workFlowSchema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    nodes: z.array(z.unknown()),
    edges: z.array(z.unknown()),
});

// Infer TypeScript type automatically
type WorkflowInput = z.infer<typeof workFlowSchema>;

// GET /api/workflows
// Retrieve all workflows
export const getAllWorkflows = async (
    _req: Request, 
    res: Response, 
    next: NextFunction
) => {
    try {
        const workflows = await prisma.workflow.findMany({
            select: {
                id: true,
                name: true,
                createdAt: true, 
                updatedAt: true,
            },
            orderBy: {
                updatedAt: 'desc',
            },
        });

        res.json(workflows);
    } catch (error) {
        next(error);
    }
};

// GET /api/workflows/:id
// Retrieve a specific workflow 
export const getWorkFlowById = async (
    req: Request<{id: string}>, // Strictly types req.params.id as string
    res: Response,
    next: NextFunction
) => { 
    try {
        const workflow = await prisma.workflow.findUnique({
            where: {
                id: req.params.id,
            },
        });

        if (!workflow) {
            res.status(404).json({error: "Workflow not found"});
            return; 
        }

        res.json(workflow);
    } catch (error) {
        next(error);
    }
};

// POST /api/workflows
// Create a new workflow
export const createWorkflow = async (
    req: Request, res: Response, next: NextFunction
) => {
    try {
        const result = workFlowSchema.safeParse(req.body);
        
        if (!result.success) {
            res.status(400).json({ error: "Invalid workflow data", details: result.error.issues });
            return;
        }

        const data: WorkflowInput = result.data;

        const workflow = await prisma.workflow.create({
            data: {
                name: data.name ?? "Untitled Workflow",
                nodes: data.nodes as Prisma.InputJsonArray, // casted to Prisma's JSON column type
                edges: data.edges as Prisma.InputJsonArray,
            },
        });

        return res.status(201).json(workflow);
    } catch (error) {
        next(error);
    }
};

// PUT /api/workflows/:id
// Update an existing workflow
export const updateWorkFlow = async (
    req: Request<{id: string}>,
    res: Response, 
    next: NextFunction
) => {
    try {
        const result = workFlowSchema.safeParse(req.body);
        
        if (!result.success) {
            res.status(400).json({ error: "Invalid workflow data", details: result.error.issues });
            return;
        }

        const data: WorkflowInput = result.data;

        const exists = await prisma.workflow.findUnique({
            where: {
                id: req.params.id,
            },
            select: {
                id: true,
            },
        });

        if (!exists) {
            res.status(404).json({ error: "Workflow not found" });
            return;
        }

        const updatedWorkflow = await prisma.workflow.update({
            where: {
                id: req.params.id,
            },
            data: {
                ...(data.name !== undefined && { name: data.name }),
                nodes: data.nodes as Prisma.InputJsonArray,
                edges: data.edges as Prisma.InputJsonArray,
            },
        });

        return res.json(updatedWorkflow);
    } catch (error) {
        next(error);
    }
};


// DELETE /api/workflows/:id
// Delete an existing workflow
export const deleteWorkflow = async (
    req: Request<{id: string}>,
    res: Response,
    next: NextFunction,
) => {
    try {
        const exists = await prisma.workflow.findUnique({
            where: {
                id: req.params.id,
            },
            select: {
                id: true,
            },
        });

        if (!exists) {
            return res.status(404).json({ error: "Workflow not found" });
        }

        await prisma.workflow.delete({
            where: {
                id: req.params.id,
            }
        });

        return res.status(204).send();
    } catch (error) {
        next(error);
    }
}

// POST /api/workflows/:id/execute
// Execute a workflow
export const executeWorkflow = async (
    req: Request<{id: string}>,
    res: Response,
    next: NextFunction,
) => {
    try {
        const workflow = await prisma.workflow.findUnique({
            where: {
                id: req.params.id
            },
        });

        if (!workflow) {
            return res.status(404).json({ error: "Workflow not found." });
        }

        const result = await execute(workflow.nodes as any[], workflow.edges as any[]); // any() to temporarily bridge type difference  

        return res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}

// POST /api/workflows/:id/execute/stream
// Streams workflow execution events to the client
export const streamEvents = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
) => {
    try {
        // Find workflow before opening SSE connection
        const workflow = await prisma.workflow.findUnique({
            where: {
                id: req.params.id,
            },
        });

        if (!workflow) {
            return res.status(404).json({
                error: "Workflow not found.",
            });
        }

        // Set required SSE headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        let clientDisconnected = false;

        // Track client disconnection
        req.on("close", () => {
            clientDisconnected = true;
            console.log("SSE client disconnected.");
        });

        // Send an SSE message
        const sendEvent = (event: string, data: unknown) => {
            if (clientDisconnected || res.writableEnded) {
                return;
            }

            res.write(`event: ${event}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        // Send initial connection event
        sendEvent("connected", {
            message: "Connected to SSE stream",
        });

        // Callback passed into workflow executor
        const constructServerSentEvent = (event: ExecutionEvent) => {
            sendEvent("node", event);
        };

        // Execute workflow and stream node events
        const result = await execute(
            workflow.nodes as any[],
            workflow.edges as any[],
            constructServerSentEvent,
        );

        // Send final execution result
        sendEvent("complete", result);

        // Close connection after execution finishes
        if (!clientDisconnected && !res.writableEnded) {
            res.end();
        }
    } catch (error) {
        // Before SSE headers are sent, use normal Express error handling
        if (!res.headersSent) {
            return next(error);
        }

        // After SSE headers are sent, send an SSE error event
        if (!res.writableEnded) {
            res.write(
                `event: error\n` +
                `data: ${JSON.stringify({
                    message: error instanceof Error
                        ? error.message
                        : "Workflow execution failed.",
                })}\n\n`,
            );

            res.end();
        }
    }
};