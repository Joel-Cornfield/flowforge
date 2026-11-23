import { Router } from "express";
import { deleteAPI, getAPI, getAPIs, saveAPI } from "../controllers/integrationsController";

const router = Router();

router.post("/", saveAPI);
router.get("/", getAPIs);
router.get("/:id", getAPI);
router.delete("/:id", deleteAPI);

export default router;