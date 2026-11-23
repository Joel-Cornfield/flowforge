
import { useEffect, useState } from "react";
import {
    getAPIs,
    type ApiIntegration,
} from "../lib/integrationApi";
import IntegrationCard from "../components/integrations/IntegrationCard";

function Integrations() {
    const [apis, setApis] = useState<ApiIntegration[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const initialiseAPIs = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const apis = await getAPIs();
                setApis(apis);
            } catch (error) {
                setError(
                    error instanceof Error
                        ? error.message
                        : "Failed to load APIs"
                );
            } finally {
                setIsLoading(false);
            }
        };

        void initialiseAPIs();
    }, []);

    if (isLoading) {
        return <div>Loading integrations...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    return (
        <div>
            <h1>API Integrations</h1>

            {apis.length === 0 ? (
                <p>No integrations found.</p>
            ) : (
                <div className="integrations-grid">
                    {apis.map((api) => (
                        <IntegrationCard
                            key={api.id}
                            api={api}
                            onClick={() => {
                                console.log("Selected API:", api.id);
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default Integrations;
