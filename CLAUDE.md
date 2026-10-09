# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview
Express 5 + Sequelize (PostgreSQL) + Redis REST API for a lubricants store (POS, inventory, purchases, sales, Bolivian SIAT electronic invoicing). Plain JavaScript, ES modules (`"type": "module"` — always use `.js` extensions in imports). Code, identifiers, and API messages are in Spanish.

## Commands
- `npm run dev` — run with nodemon (`src/server.js`)
- `npm start` — run in production mode
- `docker compose up` — Postgres (host port 5435), Redis, backend (port 3005)
- There is no test suite, linter, or build step. `npm test` is a placeholder that fails.

## Environment
`src/config/index.js` validates env vars with `env-var` and the app crashes at startup if any required one is missing. Note that it requires `REDIS_URL` and `DB_URL_PRO`, which `.env.example` does not list (it has `SERVER_REDIS` instead). Optional `FACTURACION_*` vars configure the external invoicing API.
- `NODE_ENV=development` → DB URL is built from `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`; otherwise `DB_URL_PRO` is used (`src/database/connection.js`).

## Schema management
No migration framework. On startup `src/server.js` runs `sequelize.sync()` **without** `alter`, so it only creates missing tables: editing a `*.model.js` file does NOT change existing tables. Column/ENUM changes need a one-off script in `src/scripts/` (e.g. `migrate_facturacion_siat.js`, run with `node src/scripts/<file>.js`). Seeders (`src/database/seeders/`) are wired up but commented out in `server.js`. One-off DB fixes live in root scripts (`fix_db.js`, `fix_optional_fields.js`) and `src/scripts/`. Product search needs the `unaccent` and `pg_trgm` extensions plus trigram indexes (see `Readme.md`).

## Architecture
**Auto-discovery by naming convention** — nothing is registered by hand:
- `src/database/index.js` recursively imports every `*.model.js` under `src/modules/`, calls its default export `(sequelize) => Model`, stores it as `db[model.name]`, then calls each model's static `associate(db)`.
- `src/routes/index.js` mounts `src/modules/<dir>/<dir>.routes.js` at `/api/v1/<dir>`. The routes file name must match the folder name exactly. Otherwise the module gets no routes (e.g. `catalogo_pos`, `facturas`, `detalle_proformas` have no matching routes file).

**Module layout** (`src/modules/<name>/`, see `marcas/` for a clean example):
- `routes` → `router.use(authenticate)` (JWT via passport, `auth/auth.middleware.js`), then `validate(zodSchema)`, an optional `check<X>Exists` middleware that loads the record onto `req.<x>`, and the controller.
- `schema` — Zod schemas shaped `{ body, params, query }`. `middlewares/validate.js` parses `req.body/params/query` together and puts the result on `req.validated`.
- `controller` — class instance with arrow methods; responds `{ status: 'success', data }`.
- `service` — business logic; uses `sequelize.transaction` for multi-step writes.
- `repository` (most modules) — data access via `db.<Model>`; methods accept `{ transaction }`. Listing goes through `utils/queryBuilder.js#buildSequelizeQuery` with a per-entity config (`searchableFields`, `filterableFields`, `defaultSort`, `allowedSortFields`) defined in `src/common/applyFilters.js`. Deletes are usually soft deletes (`esta_activo: false`).
- Models: class extends `Model`, UUID primary keys, `timestamps: true`, PascalCase `tableName`.

**Errors**: throw the `AppError` subclasses from `src/errors/AppError.js` (`NotFoundError`, `ValidationError`, `ConflictError`, `UnauthorizedError`). The global `errorHandler` in `src/middlewares/error.middleware.js` converts them to `{ status: 'error', code, message, errors? }` and maps Sequelize unique-constraint errors to 409.

**Cross-cutting services**:
- `services/cache.service.js` — Redis wrapper (`cache.get/set/del`, JSON, TTL). It silently no-ops if no client is set, so caching is best-effort. Used in `clientes`.
- `services/event.service.js` — app-wide `eventEmitter` with `onSafe` for async listeners (e.g. `cliente.created`).
- `middlewares/audit.middleware.js` — `auditMiddleware(action)` saves request/response metadata through the `audit` module.
- Images go to Cloudinary through `src/plugins/` and `utils/upload-files-cloud.js` (multer).

**Domain hotspots**: sales (`ventas/`) integrate with the external SIAT invoicing API in `ventas/facturacion.service.js` (payment-method → SIN code mapping, invoice numbering, `Factura` model). Inventory is spread across `productos`, `presentaciones`, `lotes`, `productos_series`, `stock_distribucion`, `kardex_movimientos`, and `ubicaciones*`. Cash register sessions are in `session_caja`. Shared enums live in `src/constants/business.constants.js`.
