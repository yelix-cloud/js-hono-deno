// deno-lint-ignore-file require-await
import { z } from 'zod';
import { YelixHono } from '../src/Hono.ts';
import { zValidatorYelix } from '@yelix/zod-validator';
import { openapi } from '../src/openapi.ts';

type Task = {
  id: number;
  title: string;
  done: boolean;
};

// Create an in-memory array to store tasks
const tasks: Task[] = [];
let nextId = 1; // To simulate auto-incrementing IDs

const app = new YelixHono();

app
  .post(
    '/tasks',
    zValidatorYelix(
      'json',
      z.object({
        title: z.string(),
      })
    ),
    openapi({
      summary: 'Create a new task',
      description: 'Create a new task with a title.',
    }),
    async (c) => {
      const { title } = c.req.valid('json' as never);
      const newTask: Task = {
        id: nextId++,
        title,
        done: false,
      };
      tasks.push(newTask);
      return c.json(
        {
          message: `${title} is created!`,
          task: newTask,
        },
        201
      );
    }
  )
  .get('/tasks', async (c) => {
    return c.json(tasks);
  })
  .delete('/tasks/:id', async (c) => {
    const taskId = Number(c.req.param('id'));
    const index = tasks.findIndex((task) => task.id === taskId);
    if (index !== -1) {
      tasks.splice(index, 1);
      return c.json({ message: `${taskId} is deleted` });
    }
    return c.json({ message: `Task ${taskId} not found` }, 404);
  })
  .put(
    '/tasks/:id',
    zValidatorYelix(
      'json',
      z.object({
        done: z.boolean(),
      })
    ),
    async (c) => {
      const taskId = Number(c.req.param('id'));
      const { done } = c.req.valid('json' as never);
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        task.done = done;
        return c.json({ message: `${taskId} is updated`, task });
      }
      return c.json({ message: `Task ${taskId} not found` }, 404);
    }
  );

app.get('/openapi.json', openapi({ hide: true }), (c) => {
  return c.json(app.getOpenAPI());
});

app.get('/docs', openapi({ hide: true }), (c) => {
  return c.html(`<!doctype html>
<html>
  <head>
    <title>My Docs</title>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script
      id="api-reference"
      data-url="/openapi.json"></script>

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

Deno.serve(app.fetch);
