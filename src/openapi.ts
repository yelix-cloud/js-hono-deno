import { namedMiddleware } from './HonoMiddleware.ts';
import type { EndpointDocs } from './types.ts';

export function openapi(endpointDocs: EndpointDocs) {
  return namedMiddleware(
    'openapi',
    async (_c, next) => {
      await next();
    },
    {
      _yelixKeys: ['openapi'],
      endpointDocs,
    }
  );
}
