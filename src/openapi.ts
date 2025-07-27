import { namedMiddleware, type YelixHonoMiddleware } from "./HonoMiddleware.ts";
import type { EndpointDocs } from "./types.ts";

// Re-export zodToResponseSchema from the dedicated module
export { zodToResponseSchema } from "./zod-to-openapi.ts";

export function openapi(endpointDocs: EndpointDocs): YelixHonoMiddleware {
  return namedMiddleware(
    "openapi",
    async (_c, next) => {
      await next();
    },
    {
      _yelixKeys: ["openapi"],
      endpointDocs,
    },
  );
}
