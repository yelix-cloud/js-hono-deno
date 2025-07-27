import type { Context } from "hono";
import type { MiddlewareHandler, Next } from "hono/types";
import type { YelixHonoMiddleware } from "./Hono.ts";
import { OpenAPIMediaType } from "@murat/openapi";

export type HonoBasedHandlers =
  | ((c: Context, next: Next) => Response | Promise<Response>)
  | MiddlewareHandler;

export type handlers = Array<
  | ((c: Context, next: Next) => Response | Promise<Response>)
  | MiddlewareHandler
  | YelixHonoMiddleware
>;

export type MountOptionHandler = (c: Context) => unknown;
export type MountReplaceRequest = (originalRequest: Request) => Request;
export type MountOptions =
  | MountOptionHandler
  | {
    optionHandler?: MountOptionHandler;
    replaceRequest?: MountReplaceRequest | false;
  };
export type RequestBody =
  | string
  | object
  | ArrayBuffer
  | ArrayBufferView
  | FormData
  | URLSearchParams
  | ReadableStream<Uint8Array>
  | Blob;

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

export type EndpointDocs = {
  hide?: boolean;
  method?: string;
  path?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  responses?: Partial<
    Record<
      HttpStatusCode,
      { description?: string; content?: Record<string, OpenAPIMediaType> }
    >
  >;
};

export type OpenAPIInformation = {
  title: string;
  description: string;
  version: string;
};

export type YelixOptionsParams = {
  debug?: boolean;
  apiKey?: string;
  environment?: "production" | "development" | string;
  yelixCloudUrl?: string;
};

export type YelixOptions = {
  debug?: boolean;
  apiKey?: string;
  environment: "production" | "development" | string;
  yelixCloudUrl: string;
};
