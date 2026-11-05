# AGENTS.md

This file provides guidance when working with code in this repository.

## What this project is

`@stotles/nestjs-graphql-zod` is a library that converts Zod v4 schemas into NestJS GraphQL types at runtime. It dynamically generates `@ObjectType`/`@InputType`-decorated classes from Zod schemas, so consumers don't need to maintain separate GraphQL schema classes. Published to npm as `@stotles/nestjs-graphql-zod`.

This repository is public. Don't reference internal Stotles repositories, apps or tickets in commits, PRs, code or comments.

## Commands

- **Build:** `npm run build` (runs `tsc`)
- **Test:** `npm test` (runs `vitest run`, which runs the whole suite once per zod version; see [Testing](#testing))
- **Single test:** `npm test -- tests/helpers/unwrap.test.ts` (both zod versions); add `--project zod-latest` or `--project zod-min` for one
- **Test watch:** `npm run test:watch`
- **Typecheck:** `npm run typecheck` (uses `tests/tsconfig.json` which covers both src and tests)
- **Lint:** `npm run lint` (oxlint, with type-aware rules via `oxlint-tsgolint`)
- **Format:** `npm run fmt` (oxfmt)
- **Format check:** `npm run fmt:check`
- **All checks (CI order):** `npm run checks` (fmt:check → build → typecheck → lint)

## Architecture

### Core pipeline: Zod schema → GraphQL class

1. **Entry points** — `modelFromZod()` (output/ObjectType) and `inputFromZod()` (input/InputType) in `src/model-from-zod.ts` and `src/decorators/input-type/input-from-zod.ts`. Both delegate to `modelFromZodBase()` which does the actual class generation.

2. **Class generation** (`modelFromZodBase`) — Creates a `DynamicZodModel` class, applies the NestJS decorator (`@ObjectType` or `@InputType`), then uses `parseShape()` to convert each Zod field into a property descriptor with a `@Field` decorator.

3. **Field resolution** (`src/helpers/get-field-info-from-zod.ts`) — The recursive core. Takes a Zod schema node and returns `ZodTypeInfo` (GraphQL type, nullability, array status, enum flag). Handles all Zod wrapper types (`$ZodOptional`, `$ZodNullable`, `$ZodDefault`, `$ZodPipe`, `$ZodLazy`, etc.) by recursively unwrapping.

4. **Direction awareness** — The `Direction` type (`'input' | 'output'`) tracks whether we're building a GraphQL input or output type. This matters for `$ZodPipe` schemas where the input and output sides differ (e.g. `z.string().transform(fn)`). The class cache in `modelFromZodBase` is partitioned by direction.

5. **Class cache** — `modelFromZodBase` maintains a `WeakMap<$ZodType, Type>` per direction to handle recursive schemas (`z.lazy(() => self)`) and avoid duplicate class generation. The cache entry is set _before_ recursing into fields, then evicted on error.

### Decorators (`src/decorators/`)

- **Method decorators** (`QueryWithZod`, `MutationWithZod`, `SubscriptionWithZod`) — wrap NestJS `@Query`/`@Mutation`/`@Subscription`. They build an output model via `modelFromZod()` and intercept the method's return value to validate it against the schema. Support `$ZodArray` input for list return types.

- **Parameter decorator** (`ZodArgs`) — wraps NestJS `@Args`. For `$ZodObject` schemas, builds an `@InputType` class via `inputFromZod()`. For primitives/arrays, resolves the type inline. Always adds a `ZodValidatorPipe` for runtime validation.

- **`makeDecoratorFromFactory`** — shared helper that bridges the library's options format to NestJS decorator factories.

### Helpers (`src/helpers/`)

- **`getZodObjectName`** — produces a type-name string from a Zod schema (e.g. `Array<String>`, `Enum<asc,desc>`). Used for error messages and as the key for `setDefaultTypeProvider`.
- **`unwrap.ts`** — peels one or many Zod wrapper layers (Optional, Nullable, Default, Array, Pipe, Lazy, etc.).
- **`zod-core-meta.ts`** — reads metadata and description from Zod v4's `globalRegistry`; determines optionality/nullability via `safeParse`.
- **`isZodInstance`** — type-safe `instanceof` check against Zod v4 core classes.
- **`buildEnumType`** — registers Zod enums with NestJS's `registerEnumType`.
- **`generate-defaults.ts`** (`getZodDefaultValue`) — extracts the default value from a `$ZodDefault`/`$ZodPrefault` nested inside identity-preserving wrappers (Optional, Nullable, Readonly, Catch, Lazy). Deliberately does _not_ traverse structural wrappers (Array, Set, Promise, Pipe), since an inner default doesn't apply to the outer schema. Cycle-aware and depth-capped.
- **`zod-validator.pipe.ts`** (`ZodValidatorPipe`) — the runtime validation pipe. Runs `parseAsync` against the schema and throws `BadRequestException` (with mapped `ValidationError`s) on `$ZodError`.

### Zod v4 specifics

The library uses `zod/v4/core` imports (not `zod` directly) to work with all Zod v4 variants (classic, mini, core). Schema metadata is read through `globalRegistry` rather than instance properties. The `graphqlTypeInput`/`graphqlTypeOutput` metadata keys serve as escape hatches for schemas the library can't infer (e.g. transforms).

- **Read schema details from `_zod.def`, not `_zod.bag`.** `bag` is an internal cache whose contents change between zod releases (zod 4.6 stopped populating `bag.format`, which turned every integer field into `Float`). Narrow with zod's classes first (e.g. `$ZodNumberFormat`, `$ZodCheckNumberFormat`) so `def` is typed without casts.
- **Don't use classic-only getters** such as `schema.format` or `schema.description`; they don't exist on zod mini or core schemas.
- **`instanceof` can give false positives on old zod.** On 4.0.x, `z.number()` can pass as `$ZodNumberFormat`, so check the actual value (e.g. `def.format`) rather than relying on the class alone.
- **Minimum zod is 4.0.16** (`peerDependencies`). Before 4.0.16, `z.keyof()` returns a union of literals instead of an enum, which `@ZodArgs` doesn't support.

## Testing

Tests use Vitest with globals enabled. The vitest config forces a `graphql` module alias to avoid dual-instance problems between ESM and CJS builds.

The suite runs against both ends of the supported zod range, via Vitest `projects` in `vitest.config.mts`:

- **`zod-latest`** — the `zod` devDependency.
- **`zod-min`** — `zod-min` (`npm:zod@4.0.16`), swapped in for `zod` and `zod/*` with `resolve.alias`.

`zod-min` must stay pinned to the minimum in the `zod` peer range; change both together. Its `npm audit` finding is expected, since it's deliberately old.

Tests directly inspect NestJS's internal `TypeMetadataStorage` to verify that generated classes have correct field metadata, nullability, and descriptions. This is the primary assertion pattern — schemas are generated and then their metadata is inspected.

## Key conventions

- The `name:description` format in `.describe()` strings (e.g. `'UserModel: A user'`) splits into a GraphQL class name and description.
- Recursion depth is capped at `MAX_ZOD_DEPTH` (from `src/helpers/constants.ts`) in multiple places to guard against infinite loops from `z.lazy()` chains.
- TypeScript 6 with `nodenext` module resolution. The build emits to `dist/`.
- **Public API surface:** `src/index.ts` re-exports only the public API (all decorators, `getZodObject`/`getZodObjectName`, `modelFromZod`/`modelFromZodBase`/`IModelFromZodOptions`). Everything else under `src/helpers/` is internal — don't assume a helper is importable by consumers just because it's exported from its own module.
- **Minimum Node is 20.19** (`engines.node`); don't use APIs newer than that. CI tests against Node 20.19, 22, 24, and 26 (see `.github/workflows/ci.yml`).
- **Held-back devDependencies:** vitest stays on 4 while Node 20 is supported (vitest 5 needs Node 22.12). TypeScript stays on 6 until `@nestjs/graphql` allows 7. `@types/node` tracks the minimum supported Node (`engines.node`, currently 20.19), so newer Node APIs fail to typecheck; raise both together.

## Releasing

Publishing is automated via `.github/workflows/publish.yml`, which triggers on pushing a `v*` git tag and runs `npm stage publish` (staged publish, using OIDC — no npm token). To cut a release:

1. Bump `version` in `package.json`.
2. Commit (the convention in history is a message like `Fix … (v4.1.3)`, often via PR).
3. Tag with a matching `v<version>` tag and push the tag — this triggers the publish workflow.

The tag must match the `package.json` version; the publish workflow fails otherwise. Packaging is controlled by `.npmignore`, which ignores everything by default and then allowlists `dist/**`, `CHANGELOG.md`, `LICENSE`, `package.json`, and `README.md`.

## Workflows

- Actions use broad tags (e.g. `actions/checkout@v7`), pinned to exact commits in `.github/workflows/actions.lock`. After changing any `uses:`, run `gh actions-lock --no-narrow` (without `--no-narrow` it rewrites the tags to full versions). `verify-lockfile.yml` checks the lockfile when workflows change.
- Audit workflows with `zizmor .github/workflows/`. Use zizmor 1.32 or newer; older versions don't understand `actions.lock` and flag every tag as unpinned.
