# Hono Abstractor

Hono Abstractor is a lightweight abstraction layer built on top of the [Hono](https://github.com/honojs/hono) web framework. It provides enhanced middleware handling, request validation, and structured routing for building scalable and maintainable web applications.

## Features

- **Middleware Abstraction**: Simplifies middleware management with named middleware and execution time logging.
- **Request Validation**: Integrates with [Zod](https://github.com/colinhacks/zod) for schema-based request validation.
- **Enhanced Routing**: Provides a structured API for defining routes with support for all HTTP methods.
- **Performance Monitoring**: Logs execution time for middleware and route handlers.

## Usage

### Basic Example

```ts
import { z } from 'zod';
import { YelixHono, zValidatorYelix } from 'jsr:@yelix/hono';

const app = new YelixHono();

app.post(
  '/tasks',
  zValidatorYelix(
    'json',
    z.object({
      title: z.string(),
    })
  ),
  async (c) => {
    const { title } = c.req.valid('json' as never);
    return c.json({ message: `Task "${title}" created!` }, 201);
  }
);

Deno.serve(app.fetch);
```

### Middleware Example

```ts
app.use('*', async (_c, next) => {
  console.log('Global middleware executed');
  await next();
});
```

### Route Example

```ts
app.get('/tasks', async (c) => {
  return c.json([{ id: 1, title: 'Sample Task', done: false }]);
});
```

## Development

To start the development server, use the following command:

```bash
deno task dev
```

This will watch for changes and reload the server automatically.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
