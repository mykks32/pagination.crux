# Contributing

## Don't let `eslint --fix` convert these imports to `import type`

A few imports across `apps/notes-api` are annotated with
`// eslint-disable-next-line @typescript-eslint/consistent-type-imports`
right above them. Don't remove those disables, and don't let an automated
`lint:fix` run "clean them up."

**Why:** `@typescript-eslint/consistent-type-imports` looks at how an
imported symbol is used *in TypeScript* and suggests `import type` when it
only ever appears in a type position (a parameter annotation, a generic
argument, etc). That's correct for pure type-checking purposes — but two
things in this codebase also need the import to be a **real, value**
import, because they need the actual class to exist at runtime:

1. **NestJS dependency injection.** A constructor parameter with no
   explicit `@Inject(...)` token is resolved by Nest via
   `reflect-metadata`'s emitted `design:paramtypes` — which only exists if
   the class was imported as a value. `import type` is erased entirely at
   compile time, so Nest sees `undefined` where it expected a class, and
   fails with "Nest can't resolve dependencies of X" at boot time.
2. **`ValidationPipe`'s `@Body()`/`@Query()` transformation.** Nest needs
   the real DTO class (again via `design:paramtypes`) to know what to
   `plainToInstance()` an incoming request into before `class-validator`
   runs against it.

Both failures are **silent until runtime** — `tsc` and `eslint` stay green,
the tests can still pass if they mock the wrong thing, and the break only
shows up when the app actually boots or an e2e/integration test exercises
the real DI container. This exact bug happened once already in this repo:
an automated `lint:fix` pass converted one of these imports, and it wasn't
caught until the e2e suite failed with a DI resolution error.

If you add a new constructor-injected provider or a new `@Body()`/`@Query()`
DTO, keep its import as a real (non-type-only) import and add the same
`eslint-disable-next-line` comment above it.
