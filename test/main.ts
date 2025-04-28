// deno-lint-ignore-file require-await
import { z } from 'zod';
import { YelixHono } from '../Hono.ts';
import { zValidatorYelix } from '../zValidator.ts';

type Task = {
  id: number;
  title: string;
  done: boolean;
};

// Create an in-memory array to store tasks
const tasks: Task[] = [];
let nextId = 1; // To simulate auto-incrementing IDs

const app = new YelixHono();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

app.use('*', async (_c, next) => {
  await sleep(100); // Simulate some processing time
  await next();
});

app.use('*', async (_c, next) => {
  await sleep(200); // Simulate some processing time
  await next();
});

app
  .post(
    '/tasks',
    zValidatorYelix(
      'json',
      z.object({
        title: z.string(),
      })
    ),
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

Deno.serve(app.fetch);
