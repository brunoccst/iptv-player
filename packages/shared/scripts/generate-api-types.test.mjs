import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { generateApiTypes, outputPath } from './generate-api-types.mjs';

it('src/api/generated/schema.ts matches openapi/backend-openapi.json (run `npm run generate:api` if this fails)', async () => {
  expect(await readFile(outputPath, 'utf8')).toBe(await generateApiTypes());
});
