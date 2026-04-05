# Architecture (Hexagonal / Ports & Adapters)

This codebase uses **hexagonal architecture** (also known as **ports and adapters**) to isolate business logic from frameworks and infrastructure.

## Folder map

- `core/domain/`
  - **Pure domain logic** (algorithms, rules, types). No Next.js imports, no database calls.
- `core/ports/`
  - **Interfaces** describing what the application needs from the outside world (auth, persistence, storage).
- `core/adapters/`
  - **Implementations** of ports using infrastructure/frameworks (Supabase, Next.js, etc).
- `core/application/`
  - **Use cases / services** that orchestrate domain logic + ports.
- `app/actions/*.js`
  - **Thin entrypoints** (Next.js server actions) that call application services and return UI-friendly DTOs.

## Rules (enforced by convention)

- `core/domain` must not import from `next/*`, `react`, `@supabase/*`, or `app/*`.
- SQL / persistence calls live in `core/adapters/persistence/**` only.
- Server actions should not contain business rules or SQL — only input shaping, calling services, and mapping outputs.

## Supabase-only persistence

Turso/libSQL has been removed. Data access is implemented via:

- `utils/supabase/server.js`: request-scoped server client (session-aware).
- `utils/supabase/admin.js`: service-role client for server-side repositories.
- `supabase/schema.sql`: the canonical Postgres schema + RPCs expected by `core/adapters/persistence/supabase/**`.

