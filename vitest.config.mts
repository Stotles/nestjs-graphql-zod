import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  oxc: {
    decorator: {
      legacy: true,
      emitDecoratorMetadata: true,
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Run the whole suite against both ends of the supported zod range: the
    // `zod` devDependency (latest) and `zod-min` (the minimum in the `zod`
    // peerDependency range).
    projects: [
      { extends: true, test: { name: 'zod-latest' } },
      {
        extends: true,
        test: { name: 'zod-min' },
        resolve: {
          // Rewrite `zod` and `zod/*` (e.g. `zod/v4/core`) to the aliased
          // package, keeping its `exports` map in charge of subpaths.
          alias: [{ find: /^zod(\/.*)?$/, replacement: 'zod-min$1' }],
        },
      },
    ],
  },
  // graphql ships both CJS (index.js) and ESM (index.mjs) entry points.
  // Vitest's resolver picks the ESM build for our test files while the CJS
  // copy is loaded by @nestjs/graphql, leaving two graphql instances in
  // memory. `instanceof` checks across the boundary fail with
  // "Cannot use GraphQLObjectType from another module or realm". Force
  // both sides to share the CJS build.
  resolve: {
    alias: [
      {
        // Match the bare `graphql` specifier exactly (so subpath imports
        // like `graphql/type/definition` keep their normal resolution).
        find: /^graphql$/,
        replacement: path.resolve(import.meta.dirname, 'node_modules/graphql/index.js'),
      },
    ],
  },
})
