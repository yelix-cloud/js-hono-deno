import type { Context } from "hono";
import type { Next, MiddlewareHandler } from "hono/types";
import type { YelixHonoMiddleware } from './Hono.ts';

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
