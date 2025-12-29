# @yelix/hono

A powerful abstraction layer built on top of the
[Hono](https://github.com/honojs/hono) web framework. It provides enhanced
middleware handling, automatic OpenAPI documentation generation, request
validation, and structured routing for building scalable and maintainable web
applications.

## Features

- **Automatic OpenAPI Documentation**: Automatically generates OpenAPI 3.0
  specifications from your routes and validation schemas
- **Request Validation**: Integrates with
  [Zod](https://github.com/colinhacks/zod) for schema-based request validation
- **Enhanced Middleware**: Named middleware with execution time logging and
  better debugging
- **Automatic Body Parsing**: Safely parses request bodies (JSON, form data,
  text, etc.) with graceful error handling
- **Performance Monitoring**: Logs execution time for middleware and route
  handlers
- **Scalar Integration**: Built-in support for exposing interactive API
  documentation using Scalar API Reference
- **Full Hono Compatibility**: All Hono features and methods are available

## Installation

```bash
deno add jsr:@yelix/hono
```

## Usage

### Basic Example

```ts
import { z } from "zod";
import { YelixHono } from "jsr:@yelix/hono";
import { zValidatorYelix } from "jsr:@yelix/zod-validator";
import { openapi } from "jsr:@yelix/hono";

const app = new YelixHono();

app.post(
  "/tasks",
  zValidatorYelix(
    "json",
    z.object({
      title: z.string(),
    }),
  ),
  openapi({
    summary: "Create a new task",
    description: "Create a new task with a title.",
  }),
  (c) => {
    const { title } = c.req.valid("json" as never);
    return c.json({ message: `Task "${title}" created!` }, 201);
  },
);

Deno.serve(app.fetch);
```

### OpenAPI Documentation

Automatically expose your API documentation:

```ts
// Expose OpenAPI JSON and interactive docs
app.exposeScalarOpenAPI({
  title: "My API Documentation",
  description: "API for managing tasks",
  openapiJsonPath: "/openapi.json",
  docsPath: "/docs",
});

// Or manually expose the OpenAPI JSON
app.get("/openapi.json", openapi({ hide: true }), (c) => {
  return c.json(app.getOpenAPI());
});
```

### Request Validation

Validate request bodies, query parameters, headers, and more:

```ts
import { zValidatorYelix } from "jsr:@yelix/zod-validator";

// Validate JSON body
app.post(
  "/users",
  zValidatorYelix(
    "json",
    z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }),
  ),
  (c) => {
    const { name, email } = c.req.valid("json" as never);
    return c.json({ message: `User ${name} created!` }, 201);
  },
);

// Validate query parameters
app.get(
  "/search",
  zValidatorYelix(
    "query",
    z.object({
      q: z.string(),
      limit: z.coerce.number().int().positive().optional(),
    }),
  ),
  (c) => {
    const { q, limit } = c.req.valid("query" as never);
    return c.json({ query: q, limit });
  },
);
```

### All HTTP Methods

```ts
app.get("/tasks", async (c) => {
  return c.json([{ id: 1, title: "Sample Task" }]);
});

app.post("/tasks", async (c) => {
  // Handle POST
});

app.put("/tasks/:id", async (c) => {
  const id = c.req.param("id");
  // Handle PUT
});

app.patch("/tasks/:id", async (c) => {
  // Handle PATCH
});

app.delete("/tasks/:id", async (c) => {
  // Handle DELETE
});

app.options("/tasks", async (c) => {
  // Handle OPTIONS
});
```

### Middleware

```ts
// Global middleware
app.use("*", async (c, next) => {
  console.log("Global middleware executed");
  await next();
});

// Path-specific middleware
app.use("/api/*", async (c, next) => {
  // Only applies to /api/* routes
  await next();
});
```

### Configuration Options

```ts
const app = new YelixHono(
  // Hono options (optional)
  {
    // Hono configuration
  },
  // Yelix options
  {
    environment: "development" | "production",
    debug: true, // Enable detailed logging
  }
);
```

## API Reference

### `YelixHono`

Main class that extends Hono functionality.

#### Constructor

```ts
new YelixHono(options?: HonoOptions, yelixOptions?: YelixOptions)
```

#### Methods

- `getOpenAPI()`: Returns the OpenAPI specification as JSON
- `exposeScalarOpenAPI(options)`: Exposes OpenAPI documentation with Scalar UI
- All standard Hono methods: `get()`, `post()`, `put()`, `delete()`, `patch()`,
  `options()`, `use()`, `route()`, etc.

### `openapi()`

Middleware for documenting endpoints in OpenAPI.

```ts
openapi({
  summary?: string;
  description?: string;
  tags?: string[];
  hide?: boolean; // Hide from OpenAPI docs
  responses?: Record<number, ResponseSchema>;
})
```

## Development

To start the development server:

```bash
deno task dev
```

This will watch for changes and reload the server automatically.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE)
file for details.
