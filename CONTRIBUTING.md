# Contributing

## `apps/notes-api` doesn't run `@typescript-eslint/consistent-type-imports`

`eslint.config.js` turns this rule off specifically for `apps/notes-api/**`
(it stays on for `packages/*`). Don't re-enable it there without reading
this first.

**Why:** the rule looks at how an imported symbol is used *in TypeScript*
and suggests rewriting the import as `import type` when it only ever
appears in a type position (a parameter annotation, a generic argument,
etc). That's correct for plain type-checking — but two NestJS mechanisms in
this app need the import to be a **real, value** import even when every
usage in the source is a type annotation:

1. **Constructor DI.** A constructor parameter's class is resolved by Nest
   via `reflect-metadata`'s emitted `design:paramtypes` — which only
   contains the real class if it was imported as a value.
2. **`ValidationPipe`'s `@Body()`/`@Query()` transformation.** Nest reads
   the same `design:paramtypes` metadata to know which DTO class to
   `plainToInstance()` an incoming request into before `class-validator`
   runs against it.

`import type` is erased entirely at compile time, so in both cases
`design:paramtypes` ends up missing the real class (TypeScript emits a
generic `Function` placeholder instead) — DI resolution or body validation
then silently no-ops. This is **silent until runtime**: `tsc` and `eslint`
stay green, unit tests can still pass if they mock the wrong thing, and the
break only shows up when the app actually boots or an e2e test exercises
the real DI container. This exact bug happened once already in this repo —
an automated `lint:fix` pass converted one of these imports to `import
type`, and it wasn't caught until the e2e suite failed with a DI resolution
error.

Turning the rule off for this app removes that failure mode entirely,
rather than relying on `// eslint-disable-next-line` comments (which
`packages/*` still needs to avoid, since it has no decorator-metadata
usage and the rule is a reliable, useful check there).

If you add a new constructor-injected provider or a new `@Body()`/`@Query()`
DTO in `apps/notes-api`, just import it normally — no disable comment, no
extra decorator needed.
