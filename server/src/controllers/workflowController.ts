import { Request, Response, NextFunction } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma"; 
import { z } from "zod";

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