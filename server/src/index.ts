import express from "express";
import cors from "cors";

const app = express();
const PORT = 3000;

// Middleware
app.use(cors()); // allows our frontend, running on a different local port, to make requests to the backend.
app.use(express.json()); // allows Express to parse incoming JSON request bodies.

// Health check endpoint
app.get("/api/health-check", (_req, res) => {
    res.json({
        status: "ok",
        message: "FlowForge API is running",
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});