import type { ApiIntegration } from "../../lib/integrationApi";

interface IntegrationCardProps {
    api: ApiIntegration;
    onClick: () => void;
}

function IntegrationCard({ api, onClick }: IntegrationCardProps) {
    // Count endpoints in the saved OpenAPI specification.
    const endpointCount = Object.values(
        api.specification.paths ?? {}
    ).reduce((total, pathItem) => {
        if (!pathItem) return total;

        const methods = [
            "get", "post", "put", "patch",
            "delete", "options", "head", "trace"
        ];

        return total + methods.filter(
            (method) => method in pathItem
        ).length;
    }, 0);

    return (
        <div className="integration-card">
            <div>
                <h3>{api.name}</h3>
                <p>{api.baseUrl}</p>
                <span>{endpointCount} endpoints</span>
            </div>

            <button onClick={onClick}>
                View API
            </button>
        </div>
    );
}

export default IntegrationCard;