import type { Context } from "hono";
import type { MiddlewareHandler, Next } from "hono/types";
import type { YelixHonoMiddleware } from "./Hono.ts";
import { ZodSchema } from "zod";

/**
 * A handler function that can be used as middleware or route handler in YelixHono.
 * Can be either a standard Hono middleware handler or a custom handler function.
 */
export type HonoBasedHandlers =
  | ((c: Context, next: Next) => Response | Promise<Response>)
  | MiddlewareHandler;

/**
 * An array of handlers that can include standard Hono handlers, middleware handlers,
 * or YelixHonoMiddleware instances. Used for defining route handlers and middleware chains.
 */
export type handlers = Array<
  | ((c: Context, next: Next) => Response | Promise<Response>)
  | MiddlewareHandler
  | YelixHonoMiddleware
>;

/**
 * A handler function for mount options that receives a Hono context.
 */
export type MountOptionHandler = (c: Context) => unknown;

/**
 * A function that can replace or modify a request before it's processed by a mounted handler.
 */
export type MountReplaceRequest = (originalRequest: Request) => Request;

/**
 * Options for mounting external application handlers.
 * Can be either a handler function or an object with optional handler and request replacement.
 */
export type MountOptions =
  | MountOptionHandler
  | {
      optionHandler?: MountOptionHandler;
      replaceRequest?: MountReplaceRequest | false;
    };

/**
 * Represents the possible types of request bodies that can be parsed and handled.
 * Includes common web formats like JSON, form data, text, binary data, and streams.
 */
export type RequestBody =
  | string
  | object
  | ArrayBuffer
  | ArrayBufferView
  | FormData
  | URLSearchParams
  | ReadableStream<Uint8Array>
  | Blob;

/**
 * HTTP status codes supported by the framework.
 * Includes all standard status codes from 1xx (Informational) to 5xx (Server Errors).
 */
export type HttpStatusCode =
  // 1xx: Informational
  | 100
  | 101
  | 102
  | 103
  // 2xx: Success
  | 200
  | 201
  | 202
  | 203
  | 204
  | 205
  | 206
  | 207
  | 208
  | 226
  // 3xx: Redirection
  | 300
  | 301
  | 302
  | 303
  | 304
  | 305
  | 306
  | 307
  | 308
  // 4xx: Client Errors
  | 400
  | 401
  | 402
  | 403
  | 404
  | 405
  | 406
  | 407
  | 408
  | 409
  | 410
  | 411
  | 412
  | 413
  | 414
  | 415
  | 416
  | 417
  | 418
  | 421
  | 422
  | 423
  | 424
  | 425
  | 426
  | 428
  | 429
  | 431
  | 451
  // 5xx: Server Errors
  | 500
  | 501
  | 502
  | 503
  | 504
  | 505
  | 506
  | 507
  | 508
  | 510
  | 511;

/**
 * Configuration object for documenting API endpoints in OpenAPI format.
 * Used with the `openapi()` middleware to describe endpoint behavior, responses, and metadata.
 */
export type EndpointDocs = {
  /** Whether to hide this endpoint from the OpenAPI documentation */
  hide?: boolean;
  /** HTTP method override for the endpoint */
  method?: string;
  /** Path override for the endpoint */
  path?: string;
  /** Brief summary of what the endpoint does */
  summary?: string;
  /** Detailed description of the endpoint */
  description?: string;
  /** Tags for categorizing the endpoint in documentation */
  tags?: string[];
  /**
   * Zod schema per HTTP status for response bodies (`application/json` in OpenAPI).
   * Use `.describe()` on fields for richer docs; per-status descriptions default to
   * `HTTP {status} response`.
   */
  responses?: Partial<Record<HttpStatusCode, ZodSchema>>;
  /**
   * When true, this endpoint participates in response-body checks against Zod
   * `responses` for the actual status (JSON only). Global
   * {@link YelixOptions.validateResponseSchemas} chooses `'warn'` vs `'error'`;
   * when that is `'none'`, mismatches still log warnings (per-endpoint opt-in).
   */
  validateResponseBody?: boolean;
};

/** How {@link YelixOptions.validateResponseSchemas} handles a mismatching body. */
export type ValidateResponseSchemasMode = "none" | "warn" | "error";

/**
 * Hono context key where `YelixHono` stores the current
 * {@link YelixOptions.validateResponseSchemas} value (for `openapi()` middleware).
 */
export const YELIX_VALIDATE_RESPONSE_SCHEMAS_KEY =
  "YELIX_VALIDATE_RESPONSE_SCHEMAS" as const;

/**
 * Hono context key: `YelixHono` installs a typed emitter so `openapi()` validation
 * can fire {@link YelixEventPayloads} without a direct app reference.
 */
export const YELIX_EMIT_EVENT_KEY = "YELIX_EMIT_EVENT" as const;

/**
 * Basic information about the OpenAPI specification.
 * Contains title, description, and version metadata.
 */
export type OpenAPIInformation = {
  /** The title of the API */
  title: string;
  /** A description of the API */
  description: string;
  /** The version of the API */
  version: string;
};

/**
 * Options for exposing OpenAPI documentation using Scalar API Reference viewer.
 * Used with `exposeScalarOpenAPI()` to configure documentation endpoints.
 */
export type OpenAPIExposeOptions = {
  /** Custom title for the documentation page */
  title?: string;
  /** Description of the API documentation */
  description?: string;
  /** Custom path for the OpenAPI JSON endpoint (defaults to "/openapi.json") */
  openapiJsonPath?: string;
  /** Custom path for the documentation page (defaults to "/docs") */
  docsPath?: string;
};

/**
 * Configuration parameters for initializing a YelixHono instance.
 * These options control debugging and environment settings.
 */
export type YelixOptionsParams = {
  /** Enable detailed debug logging for requests and middleware */
  debug?: boolean;
  /** Environment setting (production, development, or custom string) */
  environment?: "production" | "development" | string;
  /**
   * Global policy for validating outgoing JSON on routes that set
   * {@link EndpointDocs.validateResponseBody}. `'none'` does not upgrade to
   * strict errors: those routes still get warn-only checks. `'warn'` logs
   * mismatches. `'error'` replaces the response with HTTP 500.
   */
  validateResponseSchemas?: ValidateResponseSchemasMode;
};

/**
 * Resolved configuration options for a YelixHono instance.
 * Includes default values merged with user-provided parameters.
 */
export type YelixOptions = {
  /** Whether debug logging is enabled */
  debug?: boolean;
  /** The current environment setting */
  environment: "production" | "development" | string;
  /** See {@link YelixOptionsParams.validateResponseSchemas}. */
  validateResponseSchemas: ValidateResponseSchemasMode;
};

/**
 * Event payload for request start lifecycle event.
 * Emitted when a request begins processing.
 */
export type YelixEventPayloads = {
  "request.start": {
    requestId: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    body: RequestBody | undefined;
    bodyType: string;
    hasContent: boolean;
    duration: string;
    status: number;
    pathname: string;
    search: string;
    params: Record<string, string | string[]>;
    query: Record<string, string | string[]>;
  };
  "request.end": {
    requestId: string;
    method: string;
    duration: string;
    status: number;
    pathname: string;
    search: string;
    params: Record<string, string | string[]>;
    query: Record<string, string | string[]>;
    responseHeaders?: Record<string, string>;
    responseBody?: unknown;
    responseBodyType?: string;
  };
  "middleware.log": {
    requestId: string;
    middlewareName: string;
    count: string;
    messages: any[];
  };
  "middleware.start": {
    middlewareName: string;
    count: number;
    url: string;
    requestId: string;
  };
  "middleware.end": {
    requestId: string;
    middlewareName: string;
    count: number;
    duration: string;
  };
  /** Emitted when outgoing JSON fails `validateResponseBody` checks (Zod or parse). */
  "response.schema.mismatch": {
    requestId: string;
    method: string;
    pathname: string;
    responseStatus: number;
    mode: "warn" | "error";
    kind: "invalid_json" | "zod_mismatch";
    message: string;
    issues?: unknown;
  };
};

/** Context-installed callback used by response-schema validation. */
export type YelixEmitEventFn = <K extends keyof YelixEventPayloads>(
  eventName: K,
  payload: YelixEventPayloads[K],
) => void;
