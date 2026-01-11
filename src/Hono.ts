// deno-lint-ignore-file no-explicit-any
import { type Context, type ExecutionContext, Hono, type Next } from 'hono';
import process from 'node:process';
import type { HonoOptions } from 'hono/hono-base';
import type { BlankEnv } from 'hono/types';
import type {
  EndpointDocs,
  handlers,
  HonoBasedHandlers,
  MountOptions,
  OpenAPIExposeOptions,
  RequestBody,
  YelixOptions,
  YelixOptionsParams,
} from './types.ts';
import {
  createEndpointBuilder,
  type EndpointBuilder,
  OpenAPI,
  type OpenAPICore,
} from '@yelix/openapi';
import { YelixHonoMiddleware } from './HonoMiddleware.ts';
import { openapi } from './openapi.ts';

const yelixOptionsDefaults: YelixOptions = {
  environment: 'development',
  debug: false,
};

/**
 * A powerful wrapper around the Hono framework with enhanced features for building
 * production-ready APIs with automatic OpenAPI documentation, request validation,
 * and comprehensive logging.
 * 
 * YelixHono extends Hono with:
 * - Automatic OpenAPI 3.0 specification generation
 * - Enhanced middleware management with named middleware and execution tracking
 * - Automatic request body parsing with graceful error handling
 * - Performance monitoring and detailed logging
 * - Built-in Scalar API Reference integration
 * 
 * @example
 * ```ts
 * import { YelixHono } from "jsr:@yelix/hono";
 * 
 * const app = new YelixHono(undefined, {
 *   debug: true,
 *   environment: "development"
 * });
 * 
 * app.get("/", (c) => c.json({ message: "Hello World" }));
 * Deno.serve(app.fetch);
 * ```
 */
class YelixHono {
  hono: Hono;
  __openapi: OpenAPI;
  __endpoints: EndpointBuilder[] = [];
  private debug: boolean;
  private config: YelixOptions = yelixOptionsDefaults;

  /**
   * Creates a new YelixHono instance.
   * 
   * @param options - Optional Hono framework configuration options
   * @param yelixOptions - Optional Yelix-specific configuration options
   * 
   * @example
   * ```ts
   * // Basic usage
   * const app = new YelixHono();
   * 
   * // With Hono options
   * const app = new YelixHono({ strict: true });
   * 
   * // With Yelix options
   * const app = new YelixHono(undefined, {
   *   debug: true,
   *   environment: "development"
   * });
   * ```
   */
  constructor(
    options?: HonoOptions<BlankEnv>,
    yelixOptions?: YelixOptionsParams
  ) {
    this.config = { ...yelixOptionsDefaults, ...yelixOptions };
    this.debug = this.config.debug || false;
    this.hono = new Hono(options);
    this.__openapi = new OpenAPI({ debug: this.config.debug })
      .setTitle('Yelix Hono API')
      .setDescription('Yelix Hono API Documentation')
      .setVersion('1.0.0');

    // Middleware to initialize a counter for middleware execution.
    this.hono.use('*', async (c, next) => {
      if (!c.get('YELIX_LOGGED' as never)) {
        c.set('YELIX_LOGGED' as never, true);
        this.log('debug', 'Starting request processing...', {
          url: c.req.url,
          method: c.req.method,
          headers: Object.fromEntries([...c.req.raw.headers.entries()]),
        });
        const requestBody = await this.parseAndCloneBody(c.req.raw);
        requestBody.injectTo(c.req);
        this.log('debug', `Request body parsed: ${requestBody.type}`, {
          bodyType: requestBody.type,
          hasContent: !!requestBody.parsed,
        });

        const start = process.hrtime();
        const url = new URL(c.req.url);

        console.group('RS |', url.pathname, c.req.method);
        this.log(
          'info',
          `Request: ${c.req.method} ${url.pathname}, body: ${requestBody.type}`,
          { pathname: url.pathname, search: url.search }
        );

        if (!c.get('X-Yelix-Middleware-Counter' as never)) {
          c.set('X-Yelix-Middleware-Counter' as never, '0');
          this.log('debug', 'Initialized middleware counter');
        }
        this.log('debug', 'Proceeding to next middleware');
        await next();
        this.log('debug', 'Completed middleware chain execution');

        console.groupEnd();

        const end = process.hrtime();
        const difference = this.calculateDifference(start, end);
        this.log(
          'info',
          `Request completed: ${c.req.method} ${url.pathname}, duration: ${difference}`,
          {
            status: c.res.status,
            duration: difference,
            pathname: url.pathname,
          }
        );

        console.log(
          `RE | ${url.pathname}, method: ${c.req.method}, duration: ${difference}`
        );
      } else {
        this.log(
          'debug',
          'Request already logged, skipping log initialization',
          { url: c.req.url }
        );
        if (next) {
          await next();
        }
      }
    });
  }

  private log(level: string, message: string, meta?: any): void {
    if (this.debug) {
      const timestamp = new Date().toISOString();
      const prefix = `@yelix/hono [${timestamp}] [${level.toUpperCase()}]`;

      if (meta) {
        console.log(`${prefix} ${message}`, meta);
      } else {
        console.log(`${prefix} ${message}`);
      }
    }
  }

  /**
   * Retrieves the OpenAPI 3.0 specification for all documented endpoints.
   * 
   * This method collects all endpoint documentation from routes that use the
   * `openapi()` middleware and returns a complete OpenAPI specification object.
   * 
   * @returns The OpenAPI specification as a JSON-serializable object
   * 
   * @example
   * ```ts
   * // Expose OpenAPI JSON endpoint
   * app.get("/openapi.json", (c) => {
   *   return c.json(app.getOpenAPI());
   * });
   * ```
   */
  getOpenAPI(): OpenAPICore {
    const clone = Object.assign(
      Object.create(Object.getPrototypeOf(this.__openapi)),
      this.__openapi
    );

    clone.addEndpoints(this.__endpoints);
    return clone.getJSON();
  }

  /**
   * Exposes OpenAPI documentation using Scalar API Reference viewer
   * @param params - Configuration options for OpenAPI documentation exposure
   * @param params.openapiJsonPath - Optional custom path for OpenAPI JSON endpoint (defaults to "/openapi.json")
   * @param params.docsPath - Optional custom path for documentation page (defaults to "/docs")
   * @param params.title - Optional custom title for the documentation page
   * @example
   * ```typescript
   * app.exposeScalarOpenAPI({
   *   openapiJsonPath: '/openapi.json',
   *   docsPath: '/docs',
   *   title: 'My API Documentation'
   * });
   * ```
   */
  exposeScalarOpenAPI(params: OpenAPIExposeOptions) {
    this.get(
      params.openapiJsonPath ?? '/openapi.json',
      openapi({ hide: true }),
      (c) => {
        return c.json(this.getOpenAPI());
      }
    );
    
    this.__openapi
      .setTitle(params.title || 'API Documentation')
      .setDescription(params.description || 'API Documentation');
    this.get(params.docsPath ?? '/docs', openapi({ hide: true }), (c) => {
      return c.html(`<!doctype html>
<html>
  <head>
    <title>
      ${params.title || 'API Documentation'}
    </title>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script
      id="api-reference"
      data-url="${params.openapiJsonPath ?? '/openapi.json'}"></script>

    <!-- Optional: You can set a full configuration object like this: -->
    <script>
      var configuration = {};

      document.getElementById('api-reference').dataset.configuration =
        JSON.stringify(configuration)
    </script>

    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`);
    });
  }

  private async parseAndCloneBody(req: Request) {
    const contentType = req.headers.get('content-type') || '';
    const clone = req.clone();

    let type: 'json' | 'formData' | 'text' | 'arrayBuffer' | 'blob' | 'none' =
      'none';
    let parsed: RequestBody | undefined;

    // Try to parse based on content-type, but handle errors gracefully
    // Empty bodies or parsing failures should not throw errors
    if (contentType.includes('application/json')) {
      try {
        const json = await clone.json();
        // JSON parsing succeeded - null is valid JSON, so accept it
        type = 'json';
        parsed = json;
      } catch (error) {
        // Failed to parse JSON - might be malformed, empty, or invalid
        // This is not an error condition, just treat as no body
        this.log('debug', 'Failed to parse JSON body (may be empty)', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else if (
      contentType.includes('multipart/form-data') ||
      contentType.includes('application/x-www-form-urlencoded')
    ) {
      try {
        const formData = await clone.formData();
        // FormData is valid even if empty, so use it if parsing succeeded
        type = 'formData';
        parsed = formData;
      } catch (error) {
        // Failed to parse form data
        this.log('debug', 'Failed to parse form data body (may be empty)', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else if (contentType.includes('text/plain')) {
      try {
        const text = await clone.text();
        // Empty string is still valid text content
        type = 'text';
        parsed = text;
      } catch (error) {
        // Failed to parse text
        this.log('debug', 'Failed to parse text body (may be empty)', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else if (contentType.includes('application/octet-stream')) {
      try {
        const buffer = await clone.arrayBuffer();
        // ArrayBuffer is valid even if empty (byteLength === 0)
        type = 'arrayBuffer';
        parsed = buffer;
      } catch (error) {
        // Failed to parse array buffer
        this.log('debug', 'Failed to parse array buffer body (may be empty)', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else if (contentType.includes('application/blob')) {
      try {
        const blob = await clone.blob();
        // Blob is valid even if empty (size === 0)
        type = 'blob';
        parsed = blob;
      } catch (error) {
        // Failed to parse blob
        this.log('debug', 'Failed to parse blob body (may be empty)', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
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

      this.log('debug', `Executing middleware: ${name}`, {
        middlewareName: name,
        count: Number(count),
        url: c.req.url,
      });
      const start = process.hrtime();
      console.group('MS |', name);

      try {
        const response = await handler(c, next);
        const end = process.hrtime();
        console.groupEnd();
        const difference = this.calculateDifference(start, end);
        this.log('info', `Middleware ${name} completed in ${difference}`, {
          middlewareName: name,
          duration: difference,
          status: c.res.status,
        });
        console.log(`ME | ${name}, duration: ${difference}`);
        return response || c.res;
      } catch (error) {
        const end = process.hrtime();
        console.groupEnd();
        const difference = this.calculateDifference(start, end);

        this.log('error', `Middleware ${name} failed after ${difference}`, {
          middlewareName: name,
          duration: difference,
          error: error,
        });

        console.error(`ME ERROR | ${name}, duration: ${difference}`, error);
        throw error; // Re-throw to ensure error propagation
      }
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

    this.log('debug', `Parsing ${Middlewares.length} middlewares`, {
      count: Middlewares.length,
      updateNameForHandler,
    });
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
      this.log('debug', 'Assigned name "handler" to the last middleware');
      Middlewares[Middlewares.length - 1] = nameAssigned;
    }

    return Middlewares.map((handler) => {
      if (handler instanceof YelixHonoMiddleware) {
        this.log('debug', `Processing named middleware: ${handler.name}`, {
          middlewareName: handler.name,
          keys: handler.metadata?._yelixKeys,
        });
        return this.ensureMiddleware(handler.name, handler.handler);
      } else if (typeof handler === 'function') {
        this.log('debug', 'Processing anonymous middleware function', {
          handlerType: 'function',
        });
        return this.ensureMiddleware(null, handler);
      } else if (
        // Unsafe handler for edge cases
        handler &&
        typeof handler === 'object' &&
        'handler' in handler &&
        typeof (handler as any).handler === 'function'
      ) {
        const handlerName = (handler as any).name || 'anonymous';
        this.log(
          'debug',
          `Processing object-based middleware: ${handlerName}`,
          { handlerType: 'object', name: handlerName }
        );
        return this.ensureMiddleware(handlerName, (handler as any).handler);
      }
      this.log('warn', 'Encountered unknown middleware type', {
        handlerType: typeof handler,
      });
      return handler;
    });
  }

  private getMiddlewareByKey(
    key: string,
    ...handlers: handlers
  ): YelixHonoMiddleware | undefined {
    return handlers
      .filter((handler) => handler instanceof YelixHonoMiddleware)
      .find((x) =>
        x?.metadata?._yelixKeys?.includes(key)
      ) as YelixHonoMiddleware;
  }

  private getMiddlewaresByKey(
    key: string,
    ...handlers: handlers
  ): YelixHonoMiddleware[] {
    return (handlers as YelixHonoMiddleware[]) // unsafe cast
      .filter((handler) => !!handler?.name) // Ensure we only process named middlewares, to safe cast
      .filter((x) =>
        x?.metadata?._yelixKeys?.includes(key)
      ) as YelixHonoMiddleware[];
  }

  private convertColonRoutesToBraces(path: string): string {
    return path.replace(/:([^/]+)/g, (_, param) => `{${param}}`);
  }

  private loadEndpointDocs(
    _path: string,
    _method: string,
    ...handlers: handlers
  ) {
    // Log initial call with path, method and handler count
    this.log(
      'debug',
      `Loading endpoint docs for ${_method.toUpperCase()} ${_path}`,
      {
        path: _path,
        method: _method.toUpperCase(),
        handlersCount: handlers.length,
        handlerTypes: handlers.map((h) =>
          h?.name
            ? `YelixHonoMiddleware:${h.name}`
            : typeof h === 'function'
            ? `Function:${h.name || 'anonymous'}`
            : `Other:${typeof h}`
        ),
      }
    );

    // Get OpenAPI middleware if it exists
    const openapi = this.getMiddlewareByKey('openapi', ...handlers);

    // Log OpenAPI middleware details
    this.log('debug', `OpenAPI middleware ${openapi ? 'found' : 'not found'}`, {
      path: _path,
      middlewareName: openapi?.name,
      keys: openapi?.metadata?._yelixKeys,
      hasEndpointDocs: openapi?.metadata?.endpointDocs ? true : false,
      allMetadataKeys: openapi ? Object.keys(openapi.metadata || {}) : [],
    });

    const endpointDocs = openapi?.metadata.endpointDocs! as EndpointDocs;

    // Log endpoint docs details if they exist
    if (endpointDocs) {
      this.log('debug', 'Endpoint docs found', {
        endpointDocs,
        customPath: endpointDocs.path !== _path,
        customMethod: endpointDocs.method !== _method,
        hasDescription: !!endpointDocs.description,
        hasTags:
          Array.isArray(endpointDocs.tags) && endpointDocs.tags.length > 0,
        isHidden: !!endpointDocs.hide,
      });
    } else {
      this.log('debug', 'No endpoint docs found, will use defaults', {
        defaultPath: _path,
        defaultMethod: _method,
      });
    }

    // Get request validation middlewares
    const requestValidations = this.getMiddlewaresByKey(
      'requestValidation',
      ...handlers
    );

    // Log request validation middleware count
    this.log(
      'debug',
      `Found ${requestValidations.length} request validations`,
      {
        validationsCount: requestValidations.length,
        validationMiddlewareNames: requestValidations.map((rv) => rv.name),
      }
    );

    let haveJson = false,
      json = {},
      haveParameter = false;
    const parameters = [];

    // Process each request validation middleware
    for (const requestValidation of requestValidations) {
      const from = requestValidation.metadata.from;
      const schema = requestValidation.metadata.schema;

      this.log('debug', `Processing request validation from ${from}`, {
        validationName: requestValidation.name,
        from,
        hasSchema: !!schema,
        schemaType: schema ? typeof schema : 'undefined',
        isArray: Array.isArray(schema),
        keys: schema && typeof schema === 'object' ? Object.keys(schema) : [],
      });

      if (from === 'json' || from === 'form') {
        haveJson = true;
        try {
          json = Object.assign(json, schema);
          this.log('debug', `Added JSON/form schema from ${from}`, {
            from,
            schemaKeys: Object.keys(schema),
            combinedKeys: Object.keys(json),
            schemaContent: JSON.stringify(schema).substring(0, 200) + '...',
            validationName: requestValidation.name,
          });
        } catch (error) {
          this.log('error', `Failed to process ${from} schema`, {
            error,
            from,
            schema,
            validationName: requestValidation.name,
          });
        }
      } else if (['query', 'header', 'cookie', 'path', 'param'].includes(from)) {
        haveParameter = true;
        try {
          // Log each parameter being added
          if (Array.isArray(schema)) {
            this.log(
              'debug',
              `Adding ${schema.length} parameters from ${from}`,
              {
                parametersToAdd: schema.map((p) => ({
                  name: p.name,
                  in: p.in,
                  required: p.required,
                  schema: p.schema,
                })),
              }
            );
            parameters.push(...schema);
          } else {
            this.log('warn', `Schema for ${from} is not an array as expected`, {
              schema,
              validationName: requestValidation.name,
            });
          }
        } catch (error) {
          this.log('error', `Failed to process ${from} parameters`, {
            error,
            from,
            schema,
            validationName: requestValidation.name,
          });
        }
      } else {
        this.log('warn', `Unknown validation source: ${from}`, {
          validationName: requestValidation.name,
          from,
          knownSources: ['json', 'form', 'query', 'header', 'cookie', 'path'],
        });
      }
    }

    // If endpoint is marked as hidden, skip OpenAPI documentation
    if (endpointDocs?.hide) {
      this.log(
        'debug',
        'Endpoint marked as hidden, skipping OpenAPI documentation',
        { path: _path, method: _method }
      );
      return;
    }

    // Convert path format for OpenAPI
    const openapiFriendlyPath = this.convertColonRoutesToBraces(
      endpointDocs?.path || _path
    );

    // Log path conversion
    if (openapiFriendlyPath !== (endpointDocs?.path || _path)) {
      this.log('debug', 'Converted route path for OpenAPI compatibility', {
        originalPath: endpointDocs?.path || _path,
        convertedPath: openapiFriendlyPath,
        replacements: (endpointDocs?.path || _path).match(/:([^/]+)/g),
      });
    }

    const method = endpointDocs?.method || _method;
    const summary = endpointDocs?.summary || `${method.toUpperCase()} ${_path}`;
    const responses = endpointDocs?.responses || null;

    this.log(
      'info',
      `Creating OpenAPI endpoint for ${method.toUpperCase()} ${openapiFriendlyPath}`,
      {
        method: method.toUpperCase(),
        path: openapiFriendlyPath,
        summary,
        description: endpointDocs?.description || '',
        tags: endpointDocs?.tags || [],
        hasRequestBody: haveJson,
        hasParameters: haveParameter,
        parameterCount: parameters.length,
      }
    );

    try {
      // Create the endpoint builder
      const endpointPath = createEndpointBuilder()
        .setMethod(endpointDocs?.method || method)
        .setPath(openapiFriendlyPath)
        .setSummary(summary)
        .setDescription(endpointDocs?.description || '')
        .setTags(endpointDocs?.tags || []);

      // Set responses if provided
      if (responses) {
        this.log('debug', 'Setting responses for endpoint', {
          responsesCount: Object.keys(responses).length,
          responses: Object.keys(responses).map((status) => {
            const statusCode = status as unknown as keyof typeof responses;
            return {
              status,
              description: responses[statusCode]?.description || '',
              content: responses[statusCode]?.content || {},
            };
          }),
        });

        // Transform responses to ensure all descriptions are provided and content is properly typed
        const transformedResponses = Object.entries(responses).reduce(
          (acc, [status, response]) => {
            if (response) {
              const transformedContent = response.content
                ? Object.entries(response.content).reduce(
                    (contentAcc, [mediaType, mediaValue]) => {
                      if (mediaValue && mediaValue.schema) {
                        contentAcc[mediaType] = {
                          schema: mediaValue.schema as Record<string, unknown>,
                        };
                      }
                      return contentAcc;
                    },
                    {} as Record<string, { schema: Record<string, unknown> }>
                  )
                : undefined;

              acc[status] = {
                description: response.description || `HTTP ${status} response`,
                content: transformedContent,
              };
            }
            return acc;
          },
          {} as Record<
            string,
            {
              description: string;
              content?: Record<string, { schema: Record<string, unknown> }>;
            }
          >
        );

        endpointPath.setResponses(transformedResponses);
      } else {
        this.log('debug', 'No responses provided for endpoint, using defaults');
      }

      this.log('debug', 'Created endpoint builder', {
        builderMethod: endpointPath.method,
        builderPath: endpointPath.path,
      });

      // Add request body if we have JSON schema
      if (haveJson) {
        try {
          this.log('debug', 'Setting request body content', {
            contentKeys: Object.keys(json),
            jsonPreview: JSON.stringify(json).substring(0, 200) + '...',
            contentType: 'application/json',
          });
          endpointPath.setRawRequestBodyContent(json);
        } catch (error) {
          this.log('error', 'Failed to set request body content', {
            error,
            jsonKeys: Object.keys(json),
          });
        }
      }

      // Add parameters if we have any
      if (haveParameter) {
        this.log(
          'debug',
          `Adding ${parameters.length} parameters to endpoint`,
          {
            count: parameters.length,
            types: [...new Set(parameters.map((p) => p.in))],
            parametersList: parameters.map((p) => ({
              name: p.name,
              in: p.in,
              required: p.required,
            })),
          }
        );

        // Add each parameter individually and log any errors
        parameters.forEach((parameter, index) => {
          try {
            this.log('debug', `Adding parameter: ${parameter.name || index}`, {
              parameter,
              index,
            });
            endpointPath.addRawParameter(parameter);
          } catch (error) {
            this.log(
              'error',
              `Failed to add parameter: ${parameter.name || index}`,
              {
                error,
                parameter,
                index,
              }
            );
          }
        });
      }

      // Add the endpoint to our collection
      this.__endpoints.push(endpointPath);
      this.log(
        'info',
        `Added endpoint to OpenAPI: ${method.toUpperCase()} ${openapiFriendlyPath}`,
        {
          total: this.__endpoints.length,
          endpointMethod: endpointPath.method,
          endpointPath: endpointPath.path,
          index: this.__endpoints.length - 1,
        }
      );
    } catch (error) {
      this.log('error', 'Failed to create OpenAPI endpoint', {
        error,
        path: openapiFriendlyPath,
        method,
        summary,
      });
    }
  }

  /**
   * Registers a POST route with the specified path and handlers.
   * @param path - The route path.
   * @param handlers - The middleware handlers for the route.
   * @returns The current instance for chaining.
   */
  post(path: string, ...handlers: handlers): this {
    this.log('debug', `Registering POST route: ${path}`, {
      path,
      handlersCount: handlers.length,
    });
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
    this.log('debug', `Registering GET route: ${path}`, {
      path,
      handlersCount: handlers.length,
    });
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
    this.log('debug', `Registering DELETE route: ${path}`, {
      path,
      handlersCount: handlers.length,
    });
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
    this.log('debug', `Registering PUT route: ${path}`, {
      path,
      handlersCount: handlers.length,
    });
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
    this.log('debug', `Registering PATCH route: ${path}`, {
      path,
      handlersCount: handlers.length,
    });
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
    this.log('debug', `Registering OPTIONS route: ${path}`, {
      path,
      handlersCount: handlers.length,
    });
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
    this.log('debug', `Registering ALL route: ${path}`, {
      path,
      handlersCount: handlers.length,
    });
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
    this.log('debug', `Registering ${method.toUpperCase()} route: ${path}`, {
      path,
      method: method.toUpperCase(),
      handlersCount: handlers.length,
    });
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
    const segments = parts
      .flatMap((p) => p.split('/')) // split all parts by slash
      .filter((p) => p && p.trim()) // remove empty segments
      .map((p) => p.trim());

    return '/' + segments.join('/');
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
