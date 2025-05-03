import type { HonoBasedHandlers } from "./types.ts";

/**
 * Represents a middleware handler with additional metadata.
 */
export class YelixHonoMiddleware {
  handler: HonoBasedHandlers;
  name: string;
  // deno-lint-ignore no-explicit-any
  metadata: Record<string, any>;

  /**
   * @param name - The name of the middleware.
   * @param handler - The middleware handler function.
   * @param metadata - Additional metadata for the middleware.
   */
  constructor(
    name: string,
    handler: HonoBasedHandlers,
    // deno-lint-ignore no-explicit-any
    metadata: Record<string, any> = {}
  ) {
    this.handler = handler;
    this.name = name;
    this.metadata = metadata;
  }
}

/**
 * Creates a named middleware handler with additional metadata.
 * 
 * @param name - The name of the middleware.
 * @param handler - The middleware handler function.
 * @param metadata - Additional metadata for the middleware.
 * 
 * @returns A new instance of YelixHonoMiddleware.
 */
export function namedMiddleware(
  name: string,
  handler: HonoBasedHandlers,
  // deno-lint-ignore no-explicit-any
  metadata: Record<string, any> = {}
): YelixHonoMiddleware {
  return new YelixHonoMiddleware(name, handler, metadata);
}
