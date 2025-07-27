import { z } from "npm:zod";
import { zValidatorYelix } from "jsr:@yelix/zod-validator";
import {
  openapi,
  YelixHono as Hono,
  zodToResponseSchema,
} from "jsr:@yelix/hono";

const app = new Hono(undefined, {
  apiKey: Deno.env.get("YELIX_CLOUD_API_KEY"),
  environment: "production",
  yelixCloudUrl: Deno.env.get("YELIX_CLOUD_URL") || undefined,
});

app.exposeScalarOpenAPI({
  title: "Task API Documentation",
  description: "API documentation for managing tasks",
  docsPath: "/docs",
  openapiJsonPath: "/openapi.json",
});

type Task = {
  id: number;
  title: string;
  done: boolean;
};

// Create an in-memory array to store tasks
const tasks: Task[] = [];
let nextId = 1; // To simulate auto-incrementing IDs

app
  .post(
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
      responses: {
        201: {
          content: zodToResponseSchema(z.object({
            message: z.string(),
            task: z.object({
              id: z.number().int(),
              title: z.string(),
              done: z.boolean(),
            }),
          })),
          description: "Task created successfully",
        },
      },
    }),
    (c) => {
      const { title } = c.req.valid("json" as never);
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
        201,
      );
    },
  );

app.get("/tasks", (c) => {
  return c.json(tasks);
});

Deno.serve(app.fetch);
