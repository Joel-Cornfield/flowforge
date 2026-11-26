import { Link, useParams } from "react-router";
import { getAPI, type ApiIntegration } from "../lib/integrationApi";
import { useEffect, useState } from "react";
import type { OpenAPIV3 } from "openapi-types";
import "../App.css";

const HTTP_METHODS = [
    "get",
    "post",
    "put",
    "patch",
    "delete",
    "options",
    "head",
    "trace",
] as const;

interface APIEndpoint {
    method: string;
    path: string;
    operation: OpenAPIV3.OperationObject;
}

function getRequestBodySchema(
    requestBody: OpenAPIV3.RequestBodyObject | OpenAPIV3.ReferenceObject | undefined
) {
    if (!requestBody || "$ref" in requestBody) {
        return null;
    }

    const content = requestBody.content["application/json"];

    if (!content || !("schema" in content) || !content.schema) {
        return null;
    }

    const schema = content.schema;

    if ("$ref" in schema) {
        return null;
    }

    return schema;
}

function IntegrationDetails() {
    const { id } = useParams<{ id: string }>();

    const [api, setApi] = useState<ApiIntegration | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);

    useEffect(() => {
        const initialiseAPI = async () => {
            if (!id) {
                setError("Invalid integration ID");
                setIsLoading(false);
                return;
            }

            try {
                const api = await getAPI(id);
                setApi(api);
            } catch (error) {
                setError(
                    error instanceof Error
                    ? error.message
                    : "Failed to load integration"
                );
            } finally {
                setIsLoading(false);
            }
        };

        void initialiseAPI();
    }, [id]);

    const specification = api?.specification as unknown as OpenAPIV3.Document;

    const endpoints: APIEndpoint[] = Object.entries(
        specification?.paths ?? {}
    ).flatMap(([path, pathItem]) => {
        if (!pathItem) return [];
        return HTTP_METHODS.flatMap((method) => {
            const operation = pathItem[method];

            if (!operation) return [];

            return [{
                method: method.toUpperCase(),
                path, 
                operation,
            }];
        });
    });

    if (isLoading) {
        return <div>Loading integration...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    if (!api) {
        return <div>Integration not found.</div>;
    }

    return (
        <div className="integration-details">
            <Link to="/integrations">← Back to integrations</Link>

            <h1>{api.name}</h1>
            <p>{api.baseUrl}</p>

            <h2>Endpoints ({endpoints.length})</h2>

            <div className="endpoints-list">
                {endpoints.map((endpoint) => {
                    const endpointId = `${endpoint.method}-${endpoint.path}`;
                    const isExpanded = expandedEndpoint === endpointId;

                    return (
                        <div key={endpointId} className="endpoint-item">
                            <button
                                className="endpoint-header"
                                onClick={() =>
                                    setExpandedEndpoint(
                                        isExpanded ? null : endpointId
                                    )
                                }
                            >
                                <span className={`method-badge ${endpoint.method.toLowerCase()}`}>
                                    {endpoint.method}
                                </span>

                                <div className="endpoint-info">
                                    <strong>{endpoint.path}</strong>
                                    {endpoint.operation.summary && (
                                        <p>{endpoint.operation.summary}</p>
                                    )}
                                </div>

                                <span>{isExpanded ? "−" : "+"}</span>
                            </button>

                            {isExpanded && (
                                <div className="endpoint-details">
                                    {/* Parameters */}
                                    <h4>Parameters</h4>

                                    {endpoint.operation.parameters &&
                                    endpoint.operation.parameters.length > 0 ? (
                                        <ul>
                                            {endpoint.operation.parameters.map((parameter, index) => {
                                                // OpenAPI parameters can either be defined directly as ParameterObjects or
                                                // reference another parameter using $ref. Check for references before
                                                // accessing properties such as name, in, required and description.
                                                if ("$ref" in parameter) {
                                                    return (
                                                        <li key={index}>
                                                            Referenced parameter: {parameter.$ref}
                                                        </li>
                                                    );
                                                }
                                                return (
                                                    <li key={`${parameter.name}-${parameter.in}-${index}`}>
                                                        {parameter.name} ({parameter.in})
                                                        {parameter.required && " - Required"}
                                                        {parameter.description && `: ${parameter.description}`}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    ) : (
                                        <p>No parameters.</p>
                                    )}

                                    {/* Request body */}
                                    <h4>Request Body</h4>

                                    {(() => {
                                        const schema = getRequestBodySchema(endpoint.operation.requestBody);

                                        if (!schema) {
                                            return <p>No request body schema available.</p>;
                                        }

                                        if (!schema.properties) {
                                            return <p>No properties defined.</p>;
                                        }

                                        return (
                                            <div className="request-body-properties">
                                                {Object.entries(schema.properties).map(([name, property]) => {
                                                    if ("$ref" in property) {
                                                        return (
                                                            <div key={name} className="request-property">
                                                                <strong>{name}</strong>
                                                                <span>Referenced schema: {property.$ref}</span>
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <div key={name} className="request-property">
                                                            <strong>{name}</strong>
                                                            <span>{property.type ?? "unknown"}</span>

                                                            {property.description && (
                                                                <p>{property.description}</p>
                                                            )}

                                                            {schema.required?.includes(name) && (
                                                                <span className="required-label">Required</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}

                                    {/* Responses */}
                                    <h4>Responses</h4>

                                    {Object.entries(
                                        endpoint.operation.responses ?? {}
                                    ).map(([status, response]) => (
                                        <div key={status} className="response-item">
                                            <strong>{status}</strong>
                                            <span>
                                                {"description" in response
                                                    ? response.description
                                                    : "Referenced response"}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
                    </div>
                );
            }

export default IntegrationDetails;