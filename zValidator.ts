import { zValidator } from '@hono/zod-validator';
import { YelixHonoMiddleware } from './Hono.ts';
import type { ZodSchema } from 'zod';

type parsePaths = 'cookie' | 'form' | 'json' | 'query' | 'header' | 'param';

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
