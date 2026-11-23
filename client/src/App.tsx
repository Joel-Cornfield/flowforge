
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import WorkflowEditor from "./pages/WorkflowEditor";
import Integrations from "./pages/Integrations";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<WorkflowEditor />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
