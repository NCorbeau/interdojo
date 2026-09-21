# Interdojo

Fast, source-grounded drills for technical and interview readiness. The Phase 1 build includes:

- Daily Sprint, Engineering, and Interview modes;
- choice, multi-select, ordering, and anchor-reconstruction interactions;
- immediate feedback linked to the canonical Notion source;
- responsive layouts for laptop, tablet, and phone;
- local attempt history with optional cross-device sync through Cloudflare D1.

## Local development

The repository uses pnpm.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm build:vinext
```

## Cloudflare and cross-device history

The app is configured for Cloudflare Workers through vinext. Browser storage keeps the app useful during ordinary Next.js development; the same session API uses D1 when the Worker binding is available.

1. Authenticate Wrangler:

   ```bash
   pnpm wrangler login
   ```

2. Create the database:

   ```bash
   pnpm wrangler d1 create interdojo
   ```

3. Replace the placeholder `database_id` in `wrangler.jsonc` with the returned ID.

   The deployed project currently keeps the original D1 database name in
   `wrangler.jsonc` because Cloudflare database names are immutable. The database ID
   and stored session history are unchanged by the Interdojo rename.

4. Apply the migration and deploy:

   ```bash
   pnpm db:migrate:remote
   pnpm deploy:vinext
   ```

5. Protect the deployment with a Cloudflare Access allowlist for the owner's email before adding private narrative content.

For local D1 testing:

```bash
pnpm db:migrate:local
pnpm dev:vinext
```
