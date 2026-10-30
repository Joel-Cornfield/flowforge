import { Router } from "express";
import { createWorkflow, deleteWorkflow, getAllWorkflows, getWorkFlowById, updateWorkFlow } from "../controllers/workflowController";

const router = Router();

router.get("/", getAllWorkflows);
router.get("/:id", getWorkFlowById);
router.post("/", createWorkflow);
router.put("/:id", updateWorkFlow);
router.delete("/:id", deleteWorkflow);

export default router; 

