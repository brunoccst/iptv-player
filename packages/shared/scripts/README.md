# scripts

| File | Purpose |
|------|---------|
| `generate-api-types.mjs` | Converts `openapi/backend-openapi.json` to `src/api/generated/schema.ts` (openapi-typescript). Run: `npm run generate:api`. |
| `generate-api-types.test.mjs` | Fails when `schema.ts` does not match the OpenAPI document. |
