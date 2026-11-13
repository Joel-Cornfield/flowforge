import { Router } from "express";
import { createWorkflow, deleteWorkflow, executeWorkflow, getAllWorkflows, getWorkFlowById, streamEvents, updateWorkFlow } from "../controllers/workflowController";

const router = Router();

router.get("/", getAllWorkflows);
router.get("/:id", getWorkFlowById);
router.post("/", createWorkflow);
router.put("/:id", updateWorkFlow);
router.delete("/:id", deleteWorkflow);
router.post("/:id/execute/stream", streamEvents);

export default router; 

