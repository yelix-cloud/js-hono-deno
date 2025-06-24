import type { Context } from "hono";
import type { MiddlewareHandler, Next } from "hono/types";
import type { YelixHonoMiddleware } from "./Hono.ts";

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

export type EndpointDocs = {
  hide?: boolean;
  method?: string;
  path?: string;
  summary?: string;
  description?: string;
  tags?: string[];
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
};

export type YelixOptions = {
  debug?: boolean;
  apiKey?: string;
  environment: "production" | "development" | string;
};
