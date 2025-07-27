import type { ZodSchema } from "zod";
import type { OpenAPIMediaType } from "@yelix/openapi";

// OpenAPI Schema types
interface OpenAPISchema {
  type?:
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "array"
    | "object"
    | "null";
  format?: string;
  items?: OpenAPISchema;
  properties?: Record<string, OpenAPISchema>;
  required?: string[];
  enum?: unknown[];
  const?: unknown;
  example?: unknown;
  default?: unknown;
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: boolean;
  exclusiveMaximum?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  multipleOf?: number;
  additionalProperties?: OpenAPISchema | boolean;
  additionalItems?: OpenAPISchema;
  allOf?: OpenAPISchema[];
  anyOf?: OpenAPISchema[];
  oneOf?: OpenAPISchema[];
  not?: OpenAPISchema;
  title?: string;
  description?: string;
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;
  examples?: Record<string, {
    summary?: string;
    description?: string;
    value?: unknown;
    externalValue?: string;
  }>;
}

// Zod internal type definitions for accessing _def properties
interface ZodDef {
  typeName: string;
  checks?: Array<{
    kind: string;
    value?: unknown;
    inclusive?: boolean;
    version?: string;
    regex?: RegExp;
  }>;
  [key: string]: unknown;
}

interface ZodSchemaWithDef {
  _def?: ZodDef;
  _zod?: { def: ZodDef };
}

/**
 * Converts a Zod schema to OpenAPI response schema format
 * Supports OpenAPI 3.1 features and comprehensive Zod v4 type mapping
 */
export function zodToResponseSchema(
  schema: ZodSchema,
): Record<string, OpenAPIMediaType> {
  return {
    "application/json": {
      schema: zodSchemaToOpenAPISchema(schema),
    },
  };
}

/**
 * Converts a Zod schema to OpenAPI schema with comprehensive type support
 * Handles all Zod v4 types including new string formats, refinements, and complex compositions
 */
function zodSchemaToOpenAPISchema(schema: ZodSchema): OpenAPISchema {
  const schemaWithDef = schema as unknown as ZodSchemaWithDef;
  const def = schemaWithDef._zod?.def || schemaWithDef._def ||
    (schemaWithDef as unknown as { def?: ZodDef }).def;

  if (!def) {
    return { type: "object", example: {} };
  }

  // Handle ZodString and its subtypes
  if (def.type === "string") {
    const base: OpenAPISchema = { type: "string", example: "string" };
    const stringSchema = schema as unknown as {
      minLength?: number | null;
      maxLength?: number | null;
    };

    // Handle direct properties (Zod 4 approach)
    if (typeof stringSchema.minLength === "number") {
      base.minLength = stringSchema.minLength;
    }
    if (typeof stringSchema.maxLength === "number") {
      base.maxLength = stringSchema.maxLength;
    }

    // Handle string constraints and formats
    if (def.checks && Array.isArray(def.checks)) {
      for (const check of def.checks) {
        // Handle the new Zod 4 check structure with nested def
        if (check && typeof check === "object" && "def" in check) {
          const checkDef =
            (check as unknown as { def?: { format?: string; check?: string } })
              .def;
          if (checkDef) {
            // Handle format checks
            if (checkDef.format === "email" || checkDef.check === "email") {
              base.format = "email";
              base.example = "user@example.com";
            } else if (checkDef.format === "url" || checkDef.check === "url") {
              base.format = "uri";
              base.example = "https://example.com";
            } else if (
              checkDef.format === "uuid" || checkDef.check === "uuid"
            ) {
              base.format = "uuid";
              base.example = "123e4567-e89b-12d3-a456-426614174000";
            } else if (
              checkDef.format === "datetime" || checkDef.check === "datetime"
            ) {
              base.format = "date-time";
              base.example = "2023-12-25T10:30:00Z";
            } else if (
              checkDef.format === "date" || checkDef.check === "date"
            ) {
              base.format = "date";
              base.example = "2023-12-25";
            } else if (
              checkDef.format === "time" || checkDef.check === "time"
            ) {
              base.format = "time";
              base.example = "10:30:00";
            }
          }
        }

        // Handle top-level format in Zod 4 checks
        if (check && typeof check === "object" && "format" in check) {
          const format = (check as unknown as { format: string }).format;
          if (format === "email") {
            base.format = "email";
            base.example = "user@example.com";
          } else if (format === "url") {
            base.format = "uri";
            base.example = "https://example.com";
          } else if (format === "uuid") {
            base.format = "uuid";
            base.example = "123e4567-e89b-12d3-a456-426614174000";
          } else if (format === "datetime") {
            base.format = "date-time";
            base.example = "2023-12-25T10:30:00Z";
          } else if (format === "date") {
            base.format = "date";
            base.example = "2023-12-25";
          } else if (format === "time") {
            base.format = "time";
            base.example = "10:30:00";
          }
        }

        // Handle length constraints
        if (check && typeof check === "object") {
          if (
            "minLength" in check &&
            typeof (check as unknown as { minLength: unknown }).minLength ===
              "number"
          ) {
            base.minLength =
              (check as unknown as { minLength: number }).minLength;
          }
          if (
            "maxLength" in check &&
            typeof (check as unknown as { maxLength: unknown }).maxLength ===
              "number"
          ) {
            base.maxLength =
              (check as unknown as { maxLength: number }).maxLength;
          }
        }

        // Handle traditional check structure (fallback for compatibility)
        if (check && typeof check === "object" && "kind" in check) {
          switch ((check as unknown as { kind: string }).kind) {
            case "min":
              if (
                typeof (check as unknown as { value: unknown }).value ===
                  "number"
              ) {
                base.minLength = (check as unknown as { value: number }).value;
              }
              break;
            case "max":
              if (
                typeof (check as unknown as { value: unknown }).value ===
                  "number"
              ) {
                base.maxLength = (check as unknown as { value: number }).value;
              }
              break;
            case "email":
              base.format = "email";
              base.example = "user@example.com";
              break;
            case "url":
              base.format = "uri";
              base.example = "https://example.com";
              break;
            case "uuid":
              base.format = "uuid";
              base.example = "123e4567-e89b-12d3-a456-426614174000";
              break;
            case "datetime":
              base.format = "date-time";
              base.example = "2023-12-25T10:30:00Z";
              break;
            case "date":
              base.format = "date";
              base.example = "2023-12-25";
              break;
            case "time":
              base.format = "time";
              base.example = "10:30:00";
              break;
            case "regex":
              if (
                (check as unknown as { regex?: RegExp }).regex instanceof RegExp
              ) {
                base.pattern =
                  (check as unknown as { regex: RegExp }).regex.source;
              }
              break;
          }
        }
      }
    }

    // Check for format in the _zod.bag property (Zod 4 specific)
    const zodObj = schemaWithDef._zod as unknown as {
      bag?: { format?: string };
    };
    if (zodObj?.bag?.format === "email") {
      base.format = "email";
      base.example = "user@example.com";
    }

    return base;
  }

  // Handle ZodNumber
  if (def.type === "number") {
    const base: OpenAPISchema = { type: "number", example: 123.45 };

    // Check for integer constraint in Zod 4
    if (def.checks && Array.isArray(def.checks)) {
      for (const check of def.checks) {
        // Handle the new Zod 4 check structure
        if (check && typeof check === "object") {
          // Check for integer format
          if (
            "isInt" in check && (check as unknown as { isInt: boolean }).isInt
          ) {
            base.type = "integer";
            base.example = 123;
          }

          // Check for format property indicating integer
          if (
            "format" in check &&
            (check as unknown as { format: string }).format === "safeint"
          ) {
            base.type = "integer";
            base.example = 123;
          }

          // Handle min/max constraints
          if (
            "minValue" in check &&
            typeof (check as unknown as { minValue: unknown }).minValue ===
              "number"
          ) {
            const minValue =
              (check as unknown as { minValue: number }).minValue;
            if (minValue > -9007199254740991) { // Only set if not the default safe integer min
              base.minimum = minValue;
            }
          }
          if (
            "maxValue" in check &&
            typeof (check as unknown as { maxValue: unknown }).maxValue ===
              "number"
          ) {
            const maxValue =
              (check as unknown as { maxValue: number }).maxValue;
            if (maxValue < 9007199254740991) { // Only set if not the default safe integer max
              base.maximum = maxValue;
            }
          }

          // Handle nested def structure
          if ("def" in check) {
            const checkDef = (check as unknown as {
              def?: { format?: string; check?: string };
            }).def;
            if (checkDef?.format === "safeint" || checkDef?.check === "int") {
              base.type = "integer";
              base.example = 123;
            }
          }

          // Handle traditional check structure (fallback)
          if ("kind" in check) {
            switch ((check as unknown as { kind: string }).kind) {
              case "min":
                if (
                  typeof (check as unknown as { value: unknown }).value ===
                    "number"
                ) {
                  base.minimum = (check as unknown as { value: number }).value;
                  if (
                    !(check as unknown as { inclusive?: boolean }).inclusive
                  ) base.exclusiveMinimum = true;
                }
                break;
              case "max":
                if (
                  typeof (check as unknown as { value: unknown }).value ===
                    "number"
                ) {
                  base.maximum = (check as unknown as { value: number }).value;
                  if (
                    !(check as unknown as { inclusive?: boolean }).inclusive
                  ) base.exclusiveMaximum = true;
                }
                break;
              case "int":
                base.type = "integer";
                base.example = 123;
                break;
              case "multipleOf":
                if (
                  typeof (check as unknown as { value: unknown }).value ===
                    "number"
                ) {
                  base.multipleOf =
                    (check as unknown as { value: number }).value;
                }
                break;
            }
          }
        }
      }
    }

    return base;
  }

  // Handle ZodInt (Zod 4)
  if (def.type === "integer") {
    const base: OpenAPISchema = { type: "integer", example: 123 };

    if (def.checks && Array.isArray(def.checks)) {
      for (const check of def.checks) {
        if (check && typeof check === "object" && "kind" in check) {
          switch ((check as unknown as { kind: string }).kind) {
            case "min":
              if (
                typeof (check as unknown as { value: unknown }).value ===
                  "number"
              ) {
                base.minimum = (check as unknown as { value: number }).value;
                if (!(check as unknown as { inclusive?: boolean }).inclusive) {
                  base.exclusiveMinimum = true;
                }
              }
              break;
            case "max":
              if (
                typeof (check as unknown as { value: unknown }).value ===
                  "number"
              ) {
                base.maximum = (check as unknown as { value: number }).value;
                if (!(check as unknown as { inclusive?: boolean }).inclusive) {
                  base.exclusiveMaximum = true;
                }
              }
              break;
            case "multipleOf":
              if (
                typeof (check as unknown as { value: unknown }).value ===
                  "number"
              ) {
                base.multipleOf = (check as unknown as { value: number }).value;
              }
              break;
          }
        }
      }
    }

    return base;
  }

  // Handle ZodBoolean
  if (def.type === "boolean") {
    return { type: "boolean", example: true };
  }

  // Handle ZodLiteral
  if (def.type === "literal") {
    const values = (def as unknown as { values?: unknown[] }).values;
    const value = values && values.length > 0 ? values[0] : undefined;

    if (typeof value === "string") {
      return { type: "string", enum: [value], example: value };
    } else if (typeof value === "number") {
      return { type: "number", enum: [value], example: value };
    } else if (typeof value === "boolean") {
      return { type: "boolean", enum: [value], example: value };
    }
    return { const: value, example: value };
  }

  // Handle ZodEnum
  if (def.type === "enum") {
    const values = (def as unknown as { values?: string[] }).values ||
      (def as unknown as { options?: string[] }).options ||
      Object.values(
        (def as unknown as { entries?: Record<string, string> }).entries || {},
      );
    return {
      type: "string",
      enum: values,
      example: values[0] || "option",
    };
  }

  // Handle ZodArray
  if (def.type === "array") {
    // Try to find the array item type from different possible locations
    const itemType = (def as unknown as { element?: ZodSchema }).element ||
      (def as unknown as { type?: ZodSchema }).type ||
      (def as unknown as { items?: ZodSchema }).items;

    const itemSchema = itemType
      ? zodSchemaToOpenAPISchema(itemType)
      : { type: "string" as const, example: "item" };
    const base: OpenAPISchema = {
      type: "array",
      items: itemSchema,
      example: [itemSchema.example],
    };

    if (
      (def as unknown as { exactLength?: { value: number } }).exactLength !==
        undefined
    ) {
      const exactLengthValue =
        (def as unknown as { exactLength: { value: number } }).exactLength
          .value;
      base.minItems = exactLengthValue;
      base.maxItems = exactLengthValue;
    } else {
      if (
        (def as unknown as { minLength?: { value: number } }).minLength !==
          undefined
      ) {
        base.minItems =
          (def as unknown as { minLength: { value: number } }).minLength.value;
      }
      if (
        (def as unknown as { maxLength?: { value: number } }).maxLength !==
          undefined
      ) {
        base.maxItems =
          (def as unknown as { maxLength: { value: number } }).maxLength.value;
      }
    }

    return base;
  }

  // Handle ZodObject
  if (def.type === "object") {
    const properties: Record<string, OpenAPISchema> = {};
    const required: string[] = [];

    // Get shape - it might be a function or direct object
    const shapeGetter = (def as unknown as {
      shape: (() => Record<string, ZodSchema>) | Record<string, ZodSchema>;
    }).shape;
    const shape = typeof shapeGetter === "function"
      ? shapeGetter()
      : shapeGetter;

    for (const [key, value] of Object.entries(shape || {})) {
      const propSchema = value;
      const propSchemaWithDef = propSchema as unknown as ZodSchemaWithDef;
      const propDef = propSchemaWithDef._zod?.def || propSchemaWithDef._def ||
        (propSchemaWithDef as unknown as { def?: ZodDef }).def;

      properties[key] = zodSchemaToOpenAPISchema(propSchema);

      // Check if property is optional
      if (propDef?.type !== "optional" && propDef?.type !== "default") {
        required.push(key);
      }
    }

    const result: OpenAPISchema = {
      type: "object",
      properties,
    };

    if (required.length > 0) {
      result.required = required;
    }

    // Generate example object
    const exampleObj: Record<string, unknown> = {};
    for (const [key, prop] of Object.entries(properties)) {
      if (prop.example !== undefined) {
        exampleObj[key] = prop.example;
      }
    }
    if (Object.keys(exampleObj).length > 0) {
      result.example = exampleObj;
    }

    return result;
  }

  // Handle ZodOptional
  if (def.type === "optional") {
    const innerType = (def as unknown as { innerType: ZodSchema }).innerType;
    const innerSchema = zodSchemaToOpenAPISchema(innerType);
    return { ...innerSchema, nullable: true };
  }

  // Handle ZodNullable
  if (def.type === "nullable") {
    const innerType = (def as unknown as { innerType: ZodSchema }).innerType;
    const innerSchema = zodSchemaToOpenAPISchema(innerType);
    return { ...innerSchema, nullable: true };
  }

  // Handle ZodDefault
  if (def.type === "default") {
    const innerType = (def as unknown as { innerType: ZodSchema }).innerType;
    const innerSchema = zodSchemaToOpenAPISchema(innerType);
    const defaultValue =
      typeof (def as unknown as { defaultValue: unknown }).defaultValue ===
          "function"
        ? ((def as unknown as { defaultValue: () => unknown }).defaultValue)()
        : (def as unknown as { defaultValue: unknown }).defaultValue;
    return { ...innerSchema, default: defaultValue };
  }

  // Handle ZodUnion
  if (def.type === "union") {
    const options = ((def as unknown as { options: ZodSchema[] }).options || [])
      .map((option: ZodSchema) => zodSchemaToOpenAPISchema(option));
    return { anyOf: options };
  }

  // Handle ZodIntersection
  if (def.type === "intersection") {
    return {
      allOf: [
        zodSchemaToOpenAPISchema((def as unknown as { left: ZodSchema }).left),
        zodSchemaToOpenAPISchema(
          (def as unknown as { right: ZodSchema }).right,
        ),
      ],
    };
  }

  // Handle ZodRecord
  if (def.type === "record") {
    const valueType = (def as unknown as { valueType?: ZodSchema }).valueType;
    const valueSchema: OpenAPISchema = valueType
      ? zodSchemaToOpenAPISchema(valueType)
      : { type: "string" as const, example: "value" };

    return {
      type: "object",
      additionalProperties: valueSchema,
      example: { "key": valueSchema.example },
    };
  }

  // Handle ZodTuple
  if (def.type === "tuple") {
    const items = ((def as unknown as { items: ZodSchema[] }).items || []).map((
      item: ZodSchema,
    ) => zodSchemaToOpenAPISchema(item));
    const result: OpenAPISchema = {
      type: "array",
      items: items.length === 1 ? items[0] : { anyOf: items },
      minItems: items.length,
      maxItems: items.length,
      example: items.map((item) => item.example),
    };

    if ((def as unknown as { rest?: ZodSchema }).rest) {
      result.additionalItems = zodSchemaToOpenAPISchema(
        (def as unknown as { rest: ZodSchema }).rest,
      );
      delete result.maxItems;
    }

    return result;
  }

  // Handle ZodPipe (Zod 4 transform)
  if (def.type === "pipe") {
    // For pipes, use the output schema
    const out = (def as unknown as { out: ZodSchema }).out;
    return zodSchemaToOpenAPISchema(out);
  }

  // Handle ZodTransform
  if (def.type === "transform") {
    // For transforms, we can't know the output type, so use the input
    const inputSchema = (def as unknown as { schema: ZodSchema }).schema;
    return zodSchemaToOpenAPISchema(inputSchema);
  }

  // Handle ZodAny
  if (def.type === "any") {
    return { example: "any value" };
  }

  // Handle ZodUnknown
  if (def.type === "unknown") {
    return { example: "unknown value" };
  }

  // Handle ZodVoid
  if (def.type === "void") {
    return { type: "null" };
  }

  // Handle ZodNull
  if (def.type === "null") {
    return { type: "null", example: null };
  }

  // Handle ZodUndefined
  if (def.type === "undefined") {
    return { type: "null", example: null };
  }

  // Handle ZodDate
  if (def.type === "date") {
    return {
      type: "string",
      format: "date-time",
      example: "2023-12-25T10:30:00Z",
    };
  }

  // Handle ZodBigInt
  if (def.type === "bigint") {
    return { type: "integer", format: "int64", example: 9223372036854775807 };
  }

  // Handle ZodSet
  if (def.type === "set") {
    const valueType = (def as unknown as { valueType: ZodSchema }).valueType;
    const itemSchema = zodSchemaToOpenAPISchema(valueType);
    return {
      type: "array",
      items: itemSchema,
      uniqueItems: true,
      example: [itemSchema.example],
    };
  }

  // Handle ZodMap
  if (def.type === "map") {
    const valueType = (def as unknown as { valueType: ZodSchema }).valueType;
    const valueSchema = zodSchemaToOpenAPISchema(valueType);
    return {
      type: "object",
      additionalProperties: valueSchema,
      example: { "key": valueSchema.example },
    };
  }

  // Fallback for unknown types
  return { type: "object", example: {} };
}
