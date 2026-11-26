
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import WorkflowEditor from "./pages/WorkflowEditor";
import Integrations from "./pages/Integrations";
import Navbar from "./components/layout/Navbar";
import IntegrationDetails from "./pages/IntegrationDetails";

function App() {
    return (
        <BrowserRouter>
            <Navbar />
            <Routes>
                <Route path="/" element={<WorkflowEditor />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="*" element={<Navigate to="/" replace />} />
                <Route path="/integrations/:id" element={<IntegrationDetails />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
