// deno-lint-ignore-file no-explicit-any
import { type Context, type ExecutionContext, Hono, type Next } from 'hono';
import process from 'node:process';
import type { HonoOptions } from 'hono/hono-base';
import type { BlankEnv } from 'hono/types';
import type {
  RequestBody,
  HonoBasedHandlers,
  handlers,
  MountOptions,
  EndpointDocs,
  OpenAPIInformation,
} from './types.ts';
import {
  createEndpointBuilder,
  OpenAPI,
  OpenAPICore,
  type EndpointBuilder,
} from '@murat/openapi';
import { YelixHonoMiddleware } from './HonoMiddleware.ts';

/**
 * A wrapper around the Hono framework with additional features like middleware parsing,
 * enhanced logging, and route handling.
 */
class YelixHono {
  hono: Hono;
  __openapi: OpenAPIInformation;
  __endpoints: EndpointBuilder[] = [];

  /**
   * @param options - Optional configuration for the Hono instance.
   */
  constructor(options?: HonoOptions<BlankEnv>) {
    this.hono = new Hono(options);
    this.__openapi = {
      title: 'Yelix Hono API',
      description: 'Yelix Hono API Documentation',
      version: '1.0.0',
    }

    // Middleware to initialize a counter for middleware execution.
    this.hono.use('*', async (c, next) => {
      if (!c.get('YELIX_LOGGED' as never)) {
        c.set('YELIX_LOGGED' as never, true);
        const requestBody = await this.parseAndCloneBody(c.req.raw);
        requestBody.injectTo(c.req);

        const start = process.hrtime();
        const url = new URL(c.req.url);

        console.group('RS |', url.pathname, c.req.method);

        if (!c.get('X-Yelix-Middleware-Counter' as never)) {
          c.set('X-Yelix-Middleware-Counter' as never, '0');
        }
        await next();

        console.groupEnd();

        const end = process.hrtime();
        const difference = this.calculateDifference(start, end);

        console.log(
          `RE | ${url.pathname}, method: ${c.req.method}, duration: ${difference}`
        );
      } else {
        if (next) {
          await next();
        }
      }
    });
  }

  getOpenAPI(): OpenAPICore {
    const openAPIInstance = new OpenAPI()
      .setTitle(this.__openapi.title)
      .setDescription(this.__openapi.description)
      .setVersion(this.__openapi.version);

    openAPIInstance.addEndpoints(this.__endpoints);
    return openAPIInstance.getJSON();
  }

  private async parseAndCloneBody(req: Request) {
    const contentType = req.headers.get('content-type') || '';
    const clone = req.clone();

    let type: 'json' | 'formData' | 'text' | 'arrayBuffer' | 'blob' | 'none' =
      'none';
    let parsed: RequestBody | undefined;

    if (contentType.includes('application/json')) {
      const json = await clone.json();
      type = 'json';
      parsed = json;
    } else if (
      contentType.includes('multipart/form-data') ||
      contentType.includes('application/x-www-form-urlencoded')
    ) {
      const formData = await clone.formData();
      type = 'formData';
      parsed = formData;
    } else if (contentType.includes('text/plain')) {
      const text = await clone.text();
      type = 'text';
      parsed = text;
    } else if (contentType.includes('application/octet-stream')) {
      const buffer = await clone.arrayBuffer();
      type = 'arrayBuffer';
      parsed = buffer;
    } else if (contentType.includes('application/blob')) {
      const blob = await clone.blob();
      type = 'blob';
      parsed = blob;
    }

    function injectTo(honoReq: any) {
      // deno-lint-ignore require-await
      honoReq[type] = async () => parsed;
    }

    return {
      type,
      parsed,
      injectTo,
    };
  }

  /**
   * Calculates the time difference between two high-resolution timestamps.
   * @param st - Start time as a tuple of seconds and nanoseconds.
   * @param et - End time as a tuple of seconds and nanoseconds.
   * @returns A formatted string representing the time difference.
   */
  private calculateDifference(
    st: [number, number],
    et: [number, number]
  ): string {
    const diffInNanoSeconds = (et[0] - st[0]) * 1e9 + (et[1] - st[1]); // Difference in nanoseconds

    if (diffInNanoSeconds < 1000) {
      // Less than 1 microsecond -> <number>ns
      return `${diffInNanoSeconds}ns`;
    } else if (diffInNanoSeconds < 1000000) {
      // 1μs to 1000μs -> <number>μs
      const microseconds = Math.round(diffInNanoSeconds / 1000);
      return `${microseconds}μs`;
    } else if (diffInNanoSeconds < 1000000000) {
      // 1ms to 1000ms -> <number>ms
      const milliseconds = (diffInNanoSeconds / 1000000).toFixed(3);
      return `${milliseconds}ms`;
    } else if (diffInNanoSeconds < 10000000000) {
      // 1s to 10s -> <seconds>.<ms>s
      const seconds = Math.floor(diffInNanoSeconds / 1000000000);
      const milliseconds = Math.floor(
        (diffInNanoSeconds % 1000000000) / 1000000
      );
      return `${seconds}.${milliseconds}s`;
    } else {
      // More than 10s -> <seconds>s
      const seconds = Math.floor(diffInNanoSeconds / 1000000000);
      return `${seconds}s`;
    }
  }

  /**
   * Wraps a middleware handler with additional functionality like logging and execution time measurement.
   * @param name - The name of the middleware.
   * @param handler - The middleware handler function.
   * @returns A wrapped middleware function.
   */
  private ensureMiddleware(name: string | null, handler: HonoBasedHandlers) {
    return async (c: Context, next: Next) => {
      let count = c.get('X-Yelix-Middleware-Counter') ?? '';
      if (count === '' || isNaN(Number(count))) {
        count = '0';
      }
      c.set('X-Yelix-Middleware-Counter', String(Number(count) + 1));
      if (!name) {
        name = `Anonymous_${count}`;
      }

      const start = process.hrtime();
      console.group('MS |', name);
      const response = await handler(c, next);
      const end = process.hrtime();
      console.groupEnd();
      const difference = this.calculateDifference(start, end);
      console.log(`ME | ${name}, duration: ${difference}`);

      return response || c.res;
    };
  }

  /**
   * Parses and wraps an array of middleware handlers.
   * @param Middlewares - The array of middleware handlers.
   * @param updateNameForHandler - Whether to update the name of the last middleware.
   * @returns An array of wrapped middleware functions.
   */
  private parseMiddlewares(Middlewares: handlers, updateNameForHandler = true) {
    if (Middlewares.length < 1) return [];

    // Update the last middleware to have a name
    if (updateNameForHandler) {
      const lastMiddleware = Middlewares[Middlewares.length - 1];
      const nameAssigned = new YelixHonoMiddleware(
        'handler',
        lastMiddleware as HonoBasedHandlers,
        {
          _yelixKeys: ['handler'],
        }
      );
      Middlewares[Middlewares.length - 1] = nameAssigned;
    }

    return Middlewares.map((handler) => {
      if (handler instanceof YelixHonoMiddleware) {
        return this.ensureMiddleware(handler.name, handler.handler);
      } else if (typeof handler === 'function') {
        return this.ensureMiddleware(null, handler);
      } else if (
        // Unsafe handler for edge cases
        handler &&
        typeof handler === 'object' &&
        'handler' in handler &&
        typeof (handler as any).handler === 'function'
      ) {
        return this.ensureMiddleware(
          (handler as any).name || null,
          (handler as any).handler
        );
      }
      return handler;
    });
  }

  private getMiddlewareByKey(
    key: string,
    ...handlers: handlers
  ): YelixHonoMiddleware | undefined {
    return handlers
      .filter((handler) => handler instanceof YelixHonoMiddleware)
      .find((x) => x?.metadata?._yelixKeys?.includes(key)) as YelixHonoMiddleware;
  }

  private convertColonRoutesToBraces(path: string): string {
    return path.replace(/:([^/]+)/g, (_, param) => `{${param}}`);
  }
  

  private loadEndpointDocs(
    path: string,
    method: string,
    ...handlers: handlers
  ) {
    const openapi = this.getMiddlewareByKey('openapi', ...handlers);
    const endpointDocs = openapi?.metadata.endpointDocs! as EndpointDocs;

    if (endpointDocs?.hide) return;

    const openapiFriendlyPath = this.convertColonRoutesToBraces(endpointDocs?.path || path);

    const endpointPath = createEndpointBuilder()
      .setMethod(endpointDocs?.method || method)
      .setPath(openapiFriendlyPath)
      .setSummary(endpointDocs?.summary || '')
      .setDescription(endpointDocs?.description || '')
      .setTags(endpointDocs?.tags || []);

    this.__endpoints.push(endpointPath);
  }

  /**
   * Registers a POST route with the specified path and handlers.
   * @param path - The route path.
   * @param handlers - The middleware handlers for the route.
   * @returns The current instance for chaining.
   */
  post(path: string, ...handlers: handlers): this {
    this.loadEndpointDocs(path, 'post', ...handlers);

    const middlewareHandlers = this.parseMiddlewares(handlers);
    this.hono.post(path, ...middlewareHandlers);
    return this;
  }


  /**
   * Registers a GET route with the specified path and handlers.
   * @param path - The route path.
   * @param handlers - The middleware handlers for the route.
   * @returns The current instance for chaining.
   */
  get(path: string, ...handlers: handlers): this {
    this.loadEndpointDocs(path, 'get', ...handlers);

    const middlewareHandlers = this.parseMiddlewares(handlers, true);
    this.hono.get(path, ...middlewareHandlers);
    return this;
  }

  /**
   * Registers a DELETE route with the specified path and handlers.
   * @param path - The route path.
   * @param handlers - The middleware handlers for the route.
   * @returns The current instance for chaining.
   */
  delete(path: string, ...handlers: handlers): this {
    this.loadEndpointDocs(path, 'delete', ...handlers);

    const middlewareHandlers = this.parseMiddlewares(handlers);
    this.hono.delete(path, ...middlewareHandlers);
    return this;
  }

  /**
   * Registers a PUT route with the specified path and handlers.
   * @param path - The route path.
   * @param handlers - The middleware handlers for the route.
   * @returns The current instance for chaining.
   */
  put(path: string, ...handlers: handlers): this {
    this.loadEndpointDocs(path, 'put', ...handlers);

    const middlewareHandlers = this.parseMiddlewares(handlers);
    this.hono.put(path, ...middlewareHandlers);
    return this;
  }

  /**
   * Registers a PATCH route with the specified path and handlers.
   * @param path - The route path.
   * @param handlers - The middleware handlers for the route.
   * @returns The current instance for chaining.
   */
  patch(path: string, ...handlers: handlers): this {
    this.loadEndpointDocs(path, 'patch', ...handlers);

    const middlewareHandlers = this.parseMiddlewares(handlers);
    this.hono.patch(path, ...middlewareHandlers);
    return this;
  }

  /**
   * Registers an OPTIONS route with the specified path and handlers.
   * @param path - The route path.
   * @param handlers - The middleware handlers for the route.
   * @returns The current instance for chaining.
   */
  options(path: string, ...handlers: handlers): this {
    this.loadEndpointDocs(path, 'options', ...handlers);

    const middlewareHandlers = this.parseMiddlewares(handlers);
    this.hono.options(path, ...middlewareHandlers);
    return this;
  }

  /**
   * Registers a route that matches all HTTP methods with the specified path and handlers.
   * @param path - The route path.
   * @param handlers - The middleware handlers for the route.
   * @returns The current instance for chaining.
   */
  all(path: string, ...handlers: handlers): this {
    ['post', 'get', 'put', 'delete', 'patch', 'options'].forEach((method) => {
      this.loadEndpointDocs(path, method, ...handlers);
    });

    const middlewareHandlers = this.parseMiddlewares(handlers);
    this.hono.all(path, ...middlewareHandlers);
    return this;
  }

  /**
   * Registers a route with a specific HTTP method and path.
   * @param method - The HTTP method.
   * @param path - The route path.
   * @param handlers - The middleware handlers for the route.
   * @returns The current instance for chaining.
   */
  on(method: string, path: string, ...handlers: handlers): this {
    this.loadEndpointDocs(path, method, ...handlers);

    const middlewareHandlers = this.parseMiddlewares(handlers);
    this.hono.on(method, path, ...middlewareHandlers);
    return this;
  }

  /**
   * Registers middleware for a specific path or globally.
   * @param pathOrHandler - The path or the first middleware handler.
   * @param handlers - Additional middleware handlers.
   * @returns The current instance for chaining.
   */
  use(pathOrHandler: string | handlers[0], ...handlers: handlers): this {
    const middlewareHandlers =
      typeof pathOrHandler === 'string'
        ? this.parseMiddlewares(handlers, false)
        : this.parseMiddlewares([pathOrHandler, ...handlers], false);

    if (typeof pathOrHandler === 'string') {
      this.hono.use(pathOrHandler, ...middlewareHandlers);
    } else {
      this.hono.use(...middlewareHandlers);
    }
    return this;
  }

  /**
   * Mounts another Hono or YelixHono instance at the specified path.
   * @param path - The base path for the mounted instance.
   * @param instance - The instance to mount.
   * @returns The current instance for chaining.
   */
  route(path: string, instance: YelixHono | Hono): this {
    if (instance instanceof YelixHono) {
      this.hono.route(path, instance.hono);
      
      // Merge the endpoints from the mounted instance
      const endpoints = instance.__endpoints;
      for (const endpoint of endpoints) {
        const ePath = endpoint.path;
        const merged = this.mergePaths(path, ePath);
        console.log(`-${path}- and -${ePath}- merged to -${merged}-`);
        const openapiFriendlyPath = this.convertColonRoutesToBraces(merged);
        endpoint.setPath(openapiFriendlyPath);
      }
      this.__endpoints.push(...endpoints);
    } else {
      this.hono.route(path, instance);
    }

    return this;
  }

  private mergePaths(...parts: string[]): string {
    const merged = parts
      .map(p => p.trim())                 // remove extra spaces
      .filter(p => p.length > 0)          // remove empty strings
      .map((p, i) =>
        i === 0 ? p.replace(/\/+$/, '')   // first part: remove trailing slashes
               : p.replace(/^\/+/, '')    // other parts: remove leading slashes
      )
      .join('/');
  
    return '/' + merged; // always prefix with a single leading slash
  }  

  /**
   * Sets a custom error handler for the application.
   * @param handler - The error handler function.
   * @returns The current instance for chaining.
   */
  onError(
    handler: (err: Error, c: Context) => Response | Promise<Response>
  ): this {
    this.hono.onError(handler);
    return this;
  }

  /**
   * Sets a custom handler for 404 Not Found responses.
   * @param handler - The handler function for 404 responses.
   * @returns The current instance for chaining.
   */
  notFound(handler: (c: Context) => Response | Promise<Response>): this {
    this.hono.notFound(handler);
    return this;
  }

  /**
   * Sends a request to the application and returns the response.
   * @param input - The request input (URL or Request object).
   * @param requestInit - Optional request initialization options.
   * @param Env - Optional environment bindings.
   * @param executionCtx - Optional execution context.
   * @returns The response from the application.
   */
  request(
    input: RequestInfo | URL,
    requestInit?: RequestInit,
    Env?: any,
    executionCtx?: ExecutionContext
  ): Response | Promise<Response> {
    return this.hono.request(
      input,
      requestInit as undefined,
      Env,
      executionCtx
    );
  }

  /**
   * Starts the application by listening for incoming requests.
   * @returns The current instance for chaining.
   */
  fire(): this {
    this.hono.fire();
    return this;
  }

  /**
   * Sets a base path for all routes in the application.
   * @param path - The base path.
   * @returns The current instance for chaining.
   */
  basePath(path: string): this {
    this.hono.basePath(path);
    return this;
  }

  /**
   * Mounts an external application handler at the specified path.
   * @param path - The base path for the mounted handler.
   * @param applicationHandler - The external application handler function.
   * @param options - Optional mount options.
   * @returns The current instance for chaining.
   */
  mount(
    path: string,
    applicationHandler: (
      request: Request,
      ...args: any
    ) => Response | Promise<Response>,
    options?: MountOptions
  ): this {
    this.hono.mount(path, applicationHandler, options);
    return this;
  }

  /**
   * Retrieves the routes defined in the application.
   */
  get routes(): Hono['routes'] {
    return this.hono.routes;
  }

  /**
   * Retrieves the router instance used by the application.
   */
  get router(): Hono['router'] {
    return this.hono.router;
  }

  /**
   * Handles incoming requests and returns the response.
   * @param req - The incoming request.
   * @returns The response from the application.
   */
  fetch = async (req: Request): Promise<Response> => {
    return await this.hono.fetch(req);
  };
}

export { YelixHono, YelixHonoMiddleware };
