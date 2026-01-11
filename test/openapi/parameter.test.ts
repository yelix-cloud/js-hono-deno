import { YelixHono } from "../../mod.ts";
import { zValidatorYelix } from "../../../zvalidator/mod.ts";
import z from "zod";
import { assertEquals } from "jsr:@std/assert";

Deno.test("OpenAPI - Path parameters should be generated correctly", () => {
  const app = new YelixHono();

  app.get(
    "/items/:itemId",
    zValidatorYelix(
      "param",
      z.object({
        itemId: z.string(),
      }),
    ),
    (c) => c.json({ success: true }),
  );

  const openapi = app.getOpenAPI();
  const endpoint = openapi.paths["/items/{itemId}"]?.get;

  assertEquals(endpoint !== undefined, true, "Endpoint should exist");
  assertEquals(
    Array.isArray(endpoint.parameters),
    true,
    "Parameters should be an array",
  );
  assertEquals(
    endpoint.parameters?.length,
    1,
    "Should have exactly 1 parameter",
  );

  const param = endpoint.parameters?.[0];
  assertEquals(param?.name, "itemId", "Parameter name should be itemId");
  assertEquals(param?.in, "path", "Parameter should be in path");
  assertEquals(param?.required, true, "Path parameter should be required");
  assertEquals(param?.schema?.type, "string", "Schema type should be string");
});

Deno.test("OpenAPI - Query parameters should be generated correctly", () => {
  const app = new YelixHono();

  app.get(
    "/search",
    zValidatorYelix(
      "query",
      z.object({
        q: z.string(),
        page: z.number().optional(),
        limit: z.number().default(10),
      }),
    ),
    (c) => c.json({ success: true }),
  );

  const openapi = app.getOpenAPI();
  const endpoint = openapi.paths["/search"]?.get;

  assertEquals(endpoint !== undefined, true, "Endpoint should exist");
  assertEquals(
    Array.isArray(endpoint.parameters),
    true,
    "Parameters should be an array",
  );
  assertEquals(
    endpoint.parameters?.length,
    3,
    "Should have exactly 3 parameters",
  );

  const qParam = endpoint.parameters?.find((p) => p.name === "q");
  assertEquals(qParam?.in, "query", "q parameter should be in query");
  assertEquals(qParam?.required, true, "q parameter should be required");
  assertEquals(qParam?.schema?.type, "string", "q schema type should be string");

  const pageParam = endpoint.parameters?.find((p) => p.name === "page");
  assertEquals(pageParam?.in, "query", "page parameter should be in query");
  assertEquals(pageParam?.required, false, "page parameter should be optional");
  assertEquals(
    pageParam?.schema?.type,
    "number",
    "page schema type should be number",
  );

  const limitParam = endpoint.parameters?.find((p) => p.name === "limit");
  assertEquals(limitParam?.in, "query", "limit parameter should be in query");
  assertEquals(
    limitParam?.required,
    false,
    "limit parameter with default should not be required",
  );
  assertEquals(
    limitParam?.schema?.type,
    "number",
    "limit schema type should be number",
  );
});

Deno.test("OpenAPI - Header parameters should be generated correctly", () => {
  const app = new YelixHono();

  app.get(
    "/protected",
    zValidatorYelix(
      "header",
      z.object({
        authorization: z.string(),
        "x-api-key": z.string().optional(),
      }),
    ),
    (c) => c.json({ success: true }),
  );

  const openapi = app.getOpenAPI();
  const endpoint = openapi.paths["/protected"]?.get;

  assertEquals(endpoint !== undefined, true, "Endpoint should exist");
  assertEquals(
    Array.isArray(endpoint.parameters),
    true,
    "Parameters should be an array",
  );
  assertEquals(
    endpoint.parameters?.length,
    2,
    "Should have exactly 2 parameters",
  );

  const authParam = endpoint.parameters?.find((p) => p.name === "authorization");
  assertEquals(
    authParam?.in,
    "header",
    "authorization parameter should be in header",
  );
  assertEquals(
    authParam?.required,
    true,
    "authorization parameter should be required",
  );
  assertEquals(
    authParam?.schema?.type,
    "string",
    "authorization schema type should be string",
  );

  const apiKeyParam = endpoint.parameters?.find((p) => p.name === "x-api-key");
  assertEquals(
    apiKeyParam?.in,
    "header",
    "x-api-key parameter should be in header",
  );
  assertEquals(
    apiKeyParam?.required,
    false,
    "x-api-key parameter should be optional",
  );
});

Deno.test("OpenAPI - Cookie parameters should be generated correctly", () => {
  const app = new YelixHono();

  app.get(
    "/session",
    zValidatorYelix(
      "cookie",
      z.object({
        sessionId: z.string(),
        rememberMe: z.string().optional(),
      }),
    ),
    (c) => c.json({ success: true }),
  );

  const openapi = app.getOpenAPI();
  const endpoint = openapi.paths["/session"]?.get;

  assertEquals(endpoint !== undefined, true, "Endpoint should exist");
  assertEquals(
    Array.isArray(endpoint.parameters),
    true,
    "Parameters should be an array",
  );
  assertEquals(
    endpoint.parameters?.length,
    2,
    "Should have exactly 2 parameters",
  );

  const sessionParam = endpoint.parameters?.find((p) => p.name === "sessionId");
  assertEquals(
    sessionParam?.in,
    "cookie",
    "sessionId parameter should be in cookie",
  );
  assertEquals(
    sessionParam?.required,
    true,
    "sessionId parameter should be required",
  );

  const rememberParam = endpoint.parameters?.find((p) => p.name === "rememberMe");
  assertEquals(
    rememberParam?.in,
    "cookie",
    "rememberMe parameter should be in cookie",
  );
  assertEquals(
    rememberParam?.required,
    false,
    "rememberMe parameter should be optional",
  );
});

Deno.test("OpenAPI - Multiple parameter types should work together", () => {
  const app = new YelixHono();

  app.get(
    "/users/:userId",
    zValidatorYelix(
      "param",
      z.object({
        userId: z.string(),
      }),
    ),
    zValidatorYelix(
      "query",
      z.object({
        include: z.string().optional(),
      }),
    ),
    zValidatorYelix(
      "header",
      z.object({
        authorization: z.string(),
      }),
    ),
    (c) => c.json({ success: true }),
  );

  const openapi = app.getOpenAPI();
  const endpoint = openapi.paths["/users/{userId}"]?.get;

  assertEquals(endpoint !== undefined, true, "Endpoint should exist");
  assertEquals(
    Array.isArray(endpoint.parameters),
    true,
    "Parameters should be an array",
  );
  assertEquals(
    endpoint.parameters?.length,
    3,
    "Should have exactly 3 parameters",
  );

  const pathParam = endpoint.parameters?.find((p) => p.in === "path");
  assertEquals(pathParam?.name, "userId", "Should have userId path parameter");
  assertEquals(pathParam?.required, true, "Path parameter should be required");

  const queryParam = endpoint.parameters?.find((p) => p.in === "query");
  assertEquals(
    queryParam?.name,
    "include",
    "Should have include query parameter",
  );
  assertEquals(
    queryParam?.required,
    false,
    "Query parameter should be optional",
  );

  const headerParam = endpoint.parameters?.find((p) => p.in === "header");
  assertEquals(
    headerParam?.name,
    "authorization",
    "Should have authorization header parameter",
  );
  assertEquals(
    headerParam?.required,
    true,
    "Header parameter should be required",
  );
});

Deno.test("OpenAPI - Complex parameter types should be handled correctly", () => {
  const app = new YelixHono();

  app.get(
    "/filter",
    zValidatorYelix(
      "query",
      z.object({
        name: z.string().min(3).max(50),
        age: z.number().int().positive(),
        active: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
      }),
    ),
    (c) => c.json({ success: true }),
  );

  const openapi = app.getOpenAPI();
  const endpoint = openapi.paths["/filter"]?.get;

  assertEquals(endpoint !== undefined, true, "Endpoint should exist");
  assertEquals(
    endpoint.parameters?.length,
    4,
    "Should have exactly 4 parameters",
  );

  const nameParam = endpoint.parameters?.find((p) => p.name === "name");
  assertEquals(nameParam?.schema?.type, "string", "name should be string");
  assertEquals(nameParam?.schema?.minLength, 3, "name should have minLength 3");
  assertEquals(nameParam?.schema?.maxLength, 50, "name should have maxLength 50");

  const ageParam = endpoint.parameters?.find((p) => p.name === "age");
  assertEquals(ageParam?.schema?.type, "number", "age should be number");

  const activeParam = endpoint.parameters?.find((p) => p.name === "active");
  assertEquals(activeParam?.schema?.type, "boolean", "active should be boolean");
  assertEquals(activeParam?.required, false, "active should be optional");

  const tagsParam = endpoint.parameters?.find((p) => p.name === "tags");
  assertEquals(tagsParam?.schema?.type, "array", "tags should be array");
  assertEquals(tagsParam?.required, false, "tags should be optional");
});
