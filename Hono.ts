// deno-lint-ignore-file no-explicit-any
import { Context, ExecutionContext, Hono, MiddlewareHandler, Next } from 'hono';
import process from 'node:process';
import { HonoOptions } from 'hono/hono-base';
import { BlankEnv } from 'hono/types';

type HonoBasedHandlers =
  | ((c: Context, next: Next) => Promise<Response>)
  | MiddlewareHandler;

type handlers = Array<
  | ((c: Context, next: Next) => Promise<Response>)
  | MiddlewareHandler
  | YelixHonoMiddleware
>;

type MountOptionHandler = (c: Context) => unknown;
type MountReplaceRequest = (originalRequest: Request) => Request;
type MountOptions = MountOptionHandler | {
    optionHandler?: MountOptionHandler;
    replaceRequest?: MountReplaceRequest | false;
};

class YelixHonoMiddleware {
  handler: HonoBasedHandlers;
  name: string;
  metadata: Record<string, any>;

  constructor(
    name: string,
    handler: HonoBasedHandlers,
    metadata: Record<string, any> = {}
  ) {
    this.handler = handler;
    this.name = name;
    this.metadata = metadata;
  }
}

class YelixHono {
  hono: Hono;

  constructor(options?: HonoOptions<BlankEnv>) {
    this.hono = new Hono(options);

    this.hono.use('*', async (c, next) => {
      if (!c.get('X-Yelix-Middleware-Counter' as never)) {
        c.set('X-Yelix-Middleware-Counter' as never, '0');
      }
      await next();
    });
  }

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
        const name = null;
        return this.ensureMiddleware(name, handler);
      }
      return handler;
    });
  }

  post(path: string, ...handlers: handlers): this {
    const middlewareHandlers = this.parseMiddlewares(handlers);
    this.hono.post(path, ...middlewareHandlers);
    return this;
  }

  get(path: string, ...handlers: handlers): this {
    const middlewareHandlers = this.parseMiddlewares(handlers);
    this.hono.get(path, ...middlewareHandlers);
    return this;
  }

  delete(path: string, ...handlers: handlers): this {
    const middlewareHandlers = this.parseMiddlewares(handlers);
    this.hono.delete(path, ...middlewareHandlers);
    return this;
  }

  put(path: string, ...handlers: handlers): this {
    const middlewareHandlers = this.parseMiddlewares(handlers);
    this.hono.put(path, ...middlewareHandlers);
    return this;
  }

  patch(path: string, ...handlers: handlers): this {
    const middlewareHandlers = this.parseMiddlewares(handlers);
    this.hono.patch(path, ...middlewareHandlers);
    return this;
  }

  options(path: string, ...handlers: handlers): this {
    const middlewareHandlers = this.parseMiddlewares(handlers);
    this.hono.options(path, ...middlewareHandlers);
    return this;
  }

  all(path: string, ...handlers: handlers): this {
    const middlewareHandlers = this.parseMiddlewares(handlers);
    this.hono.all(path, ...middlewareHandlers);
    return this;
  }

  on(method: string, path: string, ...handlers: handlers): this {
    const middlewareHandlers = this.parseMiddlewares(handlers);
    this.hono.on(method, path, ...middlewareHandlers);
    return this;
  }

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

  route(path: string, instance: YelixHono | Hono): this {
    if (instance instanceof YelixHono) {
      this.hono.route(path, instance.hono);
    } else {
      this.hono.route(path, instance);
    }
    return this;
  }

  onError(
    handler: (err: Error, c: Context) => Response | Promise<Response>
  ): this {
    this.hono.onError(handler);
    return this;
  }

  notFound(handler: (c: Context) => Response | Promise<Response>): this {
    this.hono.notFound(handler);
    return this;
  }

  request(
    input: RequestInfo | URL,
    requestInit?: RequestInit,
    Env?: any,
    executionCtx?: ExecutionContext
  ): Response | Promise<Response> {
    return this.hono.request(input, requestInit as undefined, Env, executionCtx);
  }

  fire(): this {
    this.hono.fire();
    return this;
  }

  basePath(path: string): this {
    this.hono.basePath(path);
    return this;
  }

  mount(path: string, applicationHandler: (request: Request, ...args: any) => Response | Promise<Response>, options?: MountOptions): this {
    this.hono.mount(path, applicationHandler, options);
    return this;
  }

  get routes(): Hono['routes'] {
    return this.hono.routes;
  }
  
  get router(): Hono['router'] {
    return this.hono.router;
  }

  fetch = async (req: Request): Promise<Response> => {
    const start = process.hrtime();
    const url = new URL(req.url);

    console.group('RS |', url.pathname, req.method);

    const res = await this.hono.fetch(req);

    console.groupEnd();

    const end = process.hrtime();
    const difference = this.calculateDifference(start, end);

    console.log(
      `RE | ${url.pathname}, method: ${req.method}, duration: ${difference}`
    );

    return res;
  };
}

export { YelixHono, YelixHonoMiddleware };
