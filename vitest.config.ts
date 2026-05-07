import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
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
        replacement: path.resolve(__dirname, 'node_modules/graphql/index.js'),
      },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
