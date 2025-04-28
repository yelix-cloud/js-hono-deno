import { zValidator } from '@hono/zod-validator';
import { YelixHonoMiddleware } from './Hono.ts';
import type { ZodSchema } from 'zod';

/**
 * Defines the possible sources from which data can be parsed for validation.
 */
type parsePaths = 'cookie' | 'form' | 'json' | 'query' | 'header' | 'param';

/**
 * Creates a YelixHonoMiddleware instance for validating requests using Zod schemas.
 * @template T - The Zod schema type.
 * @param from - The source of the data to validate (e.g., 'json', 'query').
 * @param schema - The Zod schema to validate against.
 * @returns A YelixHonoMiddleware instance configured for request validation.
 */
function zValidatorYelix<T extends ZodSchema>(
  from: parsePaths,
  schema: T
): YelixHonoMiddleware {
  return new YelixHonoMiddleware('zValidator', zValidator(from, schema), {
    _yelixKeys: ['requestValidation'],
    from,
    schema,
  });
}

export { zValidatorYelix };
