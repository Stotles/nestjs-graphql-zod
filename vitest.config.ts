import path from 'node:path'
import { defineConfig } from 'vitest/config'
import swc from 'unplugin-swc'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  plugins: [
    // Vitest's default esbuild transformer doesn't honour
    // `emitDecoratorMetadata`, but @nestjs/graphql relies on it for
    // parameter decorators (e.g. @Args(_, { type: () => Foo })) and to
    // discover field types via reflect-metadata. Run tests through SWC
    // with decorator enabled so the reflection metadata is emitted just
    // like `tsc` would produce it.
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
      },
    }),
  ],
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
})
