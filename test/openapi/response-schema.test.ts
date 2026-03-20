import z from "zod";
import { assertEquals, assertExists } from "jsr:@std/assert";
import { YelixHono } from "../../mod.ts";
import { openapi } from "../../src/openapi.ts";
import { normalizeEndpointResponses } from "../../src/zod-to-openapi.ts";

Deno.test("normalizeEndpointResponses maps Zod per status to OpenAPI content", () => {
  const out = normalizeEndpointResponses({
    200: z.object({ id: z.string(), count: z.number() }),
    404: z.object({ error: z.string() }),
  });

  assertEquals(out["200"]?.description, "HTTP 200 response");
  assertExists(out["200"]?.content?.["application/json"]?.schema);
  const s200 = out["200"]!.content!["application/json"]!.schema as {
    type?: string;
    properties?: Record<string, { type?: string }>;
  };
  assertEquals(s200.type, "object");
  assertEquals(s200.properties?.id?.type, "string");
  assertEquals(s200.properties?.count?.type, "number");

  assertEquals(out["404"]?.description, "HTTP 404 response");
  const s404 = out["404"]!.content!["application/json"]!.schema as {
    properties?: Record<string, { type?: string }>;
  };
  assertEquals(s404.properties?.error?.type, "string");
});

Deno.test("getOpenAPI includes Zod responses as application/json schemas", () => {
  const app = new YelixHono();

  app.get(
    "/typed",
    openapi({
      summary: "Typed response",
      responses: {
        200: z.object({ message: z.string() }),
        400: z.object({ code: z.string() }),
      },
    }),
    (c) => c.json({ message: "ok" }),
  );

  const spec = app.getOpenAPI() as {
    paths?: Record<
      string,
      { get?: { responses?: Record<string, { content?: Record<string, { schema?: unknown }> }> } }
    >;
  };

  const op = spec.paths?.["/typed"]?.get;
  assertExists(op);

  const r200 = op.responses?.["200"];
  assertExists(r200?.content?.["application/json"]?.schema);
  const schema200 = r200.content["application/json"].schema as {
    type?: string;
    properties?: Record<string, { type?: string }>;
  };
  assertEquals(schema200.type, "object");
  assertEquals(schema200.properties?.message?.type, "string");

  const r400 = op.responses?.["400"];
  assertExists(r400?.content?.["application/json"]?.schema);
});

Deno.test("response.schema.mismatch fires on Zod mismatch when validateResponseBody is true", async () => {
  const payloads: Array<{
    kind: string;
    pathname: string;
    mode: string;
  }> = [];

  const app = new YelixHono();
  app.onYelixEvent("response.schema.mismatch", (p) => {
    payloads.push({
      kind: p.kind,
      pathname: p.pathname,
      mode: p.mode,
    });
  });

  app.get(
    "/mismatch",
    openapi({
      validateResponseBody: true,
      responses: {
        200: z.object({ n: z.number() }),
      },
    }),
    (c) => c.json({ n: "wrong" }),
  );

  const res = await app.fetch(new Request("http://localhost/mismatch"));
  assertEquals(res.status, 200);
  assertEquals(payloads.length, 1);
  assertEquals(payloads[0].kind, "zod_mismatch");
  assertEquals(payloads[0].pathname, "/mismatch");
  assertEquals(payloads[0].mode, "warn");

  const body = await res.json() as { n: string };
  assertEquals(body.n, "wrong");
});

Deno.test("validateResponseSchemas error replaces response with 500 on mismatch", async () => {
  const app = new YelixHono(undefined, {
    validateResponseSchemas: "error",
  });

  app.get(
    "/strict",
    openapi({
      validateResponseBody: true,
      responses: {
        200: z.object({ ok: z.boolean() }),
      },
    }),
    (c) => c.json({ ok: "no" }),
  );

  const res = await app.fetch(new Request("http://localhost/strict"));
  assertEquals(res.status, 500);
  const json = await res.json() as { isOk?: boolean; message?: string };
  assertEquals(json.isOk, false);
  assertEquals(typeof json.message, "string");
  assertEquals(
    json.message!.includes("does not match") &&
      json.message!.includes("/strict"),
    true,
  );
});

Deno.test("validateResponseBody skips when Content-Type is not JSON", async () => {
  const payloads: unknown[] = [];
  const app = new YelixHono();
  app.onYelixEvent("response.schema.mismatch", (p) => {
    payloads.push(p);
  });

  app.get(
    "/text",
    openapi({
      validateResponseBody: true,
      responses: {
        200: z.object({ x: z.number() }),
      },
    }),
    (c) => c.text("plain"),
  );

  const res = await app.fetch(new Request("http://localhost/text"));
  assertEquals(res.status, 200);
  assertEquals(payloads.length, 0);
});
