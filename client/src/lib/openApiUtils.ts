import type { OpenAPIV3 } from "openapi-types";

export function resolveReference(
    reference: string,
    specification: OpenAPIV3.Document
): unknown {
    const referencePath = reference.replace(/^#\//, "");

    const pathParts = referencePath
        .split("/")
        .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));

    let result: unknown = specification;

    for (const part of pathParts) {
        if (
            typeof result != "object" ||
            result === null || 
            !(part in result)
        ) {
            return null;
        }

        result = (result as Record<string, unknown>)[part];
    }
    
    return result;
}