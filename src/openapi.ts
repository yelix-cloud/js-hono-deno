import type { Context, Next } from "hono";
import { namedMiddleware, type YelixHonoMiddleware } from "./HonoMiddleware.ts";
import type { EndpointDocs } from "./types.ts";
import { validateDocumentedResponseBody } from "./zod-to-openapi.ts";

// Re-export helpers from the dedicated module
export {
  normalizeEndpointResponses,
  validateDocumentedResponseBody,
} from "./zod-to-openapi.ts";

/**
 * Creates an OpenAPI documentation middleware for an endpoint.
 * 
 * This middleware is used to document API endpoints in OpenAPI 3.0 format.
 * When used with route handlers, it automatically generates OpenAPI specifications
 * that can be exposed via `getOpenAPI()` or `exposeScalarOpenAPI()`.
 * 
 * @param endpointDocs - Configuration object for documenting the endpoint
 * @returns A YelixHonoMiddleware instance that can be used in route definitions
 * 
 * @example
 * ```ts
 * app.post(
 *   "/tasks",
 *   openapi({
 *     summary: "Create a new task",
 *     description: "Creates a task with the provided title",
 *     tags: ["tasks"],
 *   }),
 *   handler
 * );
 * ```
 */
export function openapi(endpointDocs: EndpointDocs): YelixHonoMiddleware {
  return namedMiddleware(
    "openapi",
    async (c: Context, next: Next) => {
      await next();
      await validateDocumentedResponseBody(c, endpointDocs);
    },
    {
      _yelixKeys: ["openapi"],
      endpointDocs,
    },
  );
}
