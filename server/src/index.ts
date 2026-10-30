import express from "express";
import cors from "cors";
import "dotenv/config";
import workflowRoutes from "./routes/workflowRoutes";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middleware
app.use(
    cors({
        origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
    })
); // allows our frontend, running on a different local port, to make requests to the backend.
app.use(express.json({ limit: "1mb" })); // allows Express to parse incoming JSON request bodies.

// Health check endpoint
app.get("/api/health-check", (_req, res) => {
    res.json({
        status: "ok",
        message: "FlowForge API is running",
    });
});

// Global error handler 
app.use((
    err: unknown, 
    _req: express.Request, 
    res: express.Response, 
    _next: express.NextFunction
) => {
    console.error('API error:', err);

    res.status(500).json({
        success: false,
        message: "An unexpected server error occured",
    });
});

app.use("/api/workflows", workflowRoutes);
// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});