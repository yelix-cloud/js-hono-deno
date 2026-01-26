import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { YelixHono } from "../src/Hono.ts";

Deno.test("Type-safe Yelix events - request lifecycle", async () => {
  const app = new YelixHono();
  const events: Array<{ name: string; payload: any }> = [];

  // Register type-safe event listeners
  app.onYelixEvent("request.start", (payload) => {
    events.push({
      name: "request.start",
      payload: {
        requestId: payload.requestId,
        method: payload.method,
        pathname: payload.pathname,
      },
    });
  });

  app.onYelixEvent("request.end", (payload) => {
    events.push({
      name: "request.end",
      payload: {
        requestId: payload.requestId,
        status: payload.status,
      },
    });
  });

  app.get("/", (c) => c.json({ message: "Hello" }));

  const res = await app.fetch(new Request("http://localhost/"));
  assertEquals(res.status, 200);

  // Verify events were emitted in correct order
  assertEquals(events.length, 2);
  assertEquals(events[0].name, "request.start");
  assertEquals(events[1].name, "request.end");
});

Deno.test("Type-safe Yelix events - middleware lifecycle", async () => {
  const app = new YelixHono(undefined, { debug: false });
  const events: Array<{ name: string; payload: any }> = [];

  // Register type-safe middleware event listeners
  app.onYelixEvent("middleware.start", (payload) => {
    events.push({
      name: "middleware.start",
      payload: {
        middlewareName: payload.middlewareName,
        count: payload.count,
      },
    });
  });

  app.onYelixEvent("middleware.end", (payload) => {
    events.push({
      name: "middleware.end",
      payload: {
        middlewareName: payload.middlewareName,
        duration: payload.duration,
      },
    });
  });

  app.get("/", (c) => c.json({ test: "data" }));

  const res = await app.fetch(new Request("http://localhost/"));
  assertEquals(res.status, 200);

  // Should have middleware events for request start, handler, and completion
  assertEquals(events.length > 0, true);
});
