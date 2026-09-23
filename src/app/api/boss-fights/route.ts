import { ruleCopyBossFight } from "../../../lib/boss-fight/scenario";
import { compareBossFightRuns, validateBossFightRun } from "../../../lib/boss-fight/run";
import type { BossFightRun } from "../../../lib/boss-fight/run";

type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  all: () => Promise<{ results?: unknown[] }>;
  first: () => Promise<unknown>;
  run: () => Promise<{ meta?: { changes?: number } }>;
};

export type D1Database = {
  prepare: (query: string) => D1Statement;
};

async function getDatabase(): Promise<D1Database | undefined> {
  try {
    const workers = await import("cloudflare:workers");
    return (workers.env as { DB?: D1Database }).DB;
  } catch {
    return undefined;
  }
}

function parseRun(row: unknown): BossFightRun | null {
  if (!row || typeof row !== "object" || !("payload" in row)) return null;
  try {
    const run: unknown = JSON.parse((row as { payload: string }).payload);
    return validateBossFightRun(run, ruleCopyBossFight).length ? null : run as BossFightRun;
  } catch {
    return null;
  }
}

function response(payload: object, status = 200): Response {
  return Response.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

async function findRun(database: D1Database, id: string): Promise<BossFightRun | null> {
  const row = await database.prepare("SELECT payload FROM boss_fight_runs WHERE id = ?").bind(id).first();
  return parseRun(row);
}

export async function GET() {
  const database = await getDatabase();
  if (!database) return response({ runs: [], storage: "local" });
  const result = await database.prepare(
    "SELECT payload FROM boss_fight_runs ORDER BY updated_at DESC LIMIT 30",
  ).all();
  const runs = (result.results ?? []).map(parseRun).filter((run): run is BossFightRun => run !== null);
  return response({ runs, storage: "d1" });
}

export async function PUT(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const errors = validateBossFightRun(body, ruleCopyBossFight);
  if (errors.length) return response({ error: "Invalid Boss Fight run", details: errors }, 400);
  const run = body as BossFightRun;
  const database = await getDatabase();
  if (!database) return response({ run, stored: false, storage: "local" }, 202);

  return saveBossFightRunToDatabase(database, run);
}

/** Kept separate from the request binding for deterministic D1 conflict tests. */
export async function saveBossFightRunToDatabase(database: D1Database, run: BossFightRun): Promise<Response> {
  const existing = await findRun(database, run.id);
  if (!existing) {
    await database.prepare(
      `INSERT INTO boss_fight_runs
        (id, scenario_id, scenario_version, started_at, updated_at, completed_at, decision_count, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
    ).bind(
      run.id,
      run.state.scenarioId,
      run.state.scenarioVersion,
      run.startedAt,
      run.updatedAt,
      run.completedAt,
      run.state.decisions.length,
      JSON.stringify(run),
    ).run();
    const saved = await findRun(database, run.id);
    if (!saved) return response({ error: "Stored Boss Fight run is invalid" }, 500);
    const relation = compareBossFightRuns(saved, run);
    if (relation === "same") return response({ run: saved, stored: true, storage: "d1" }, 201);
    return response({ run: saved, stored: false, storage: "d1", error: "Run changed on another device" }, 409);
  }

  const relation = compareBossFightRuns(existing, run);
  if (relation === "same") return response({ run: existing, stored: true, storage: "d1" });
  if (relation !== "advance") {
    return response({ run: existing, stored: false, storage: "d1", error: "Run changed on another device" }, 409);
  }

  const result = await database.prepare(
    `UPDATE boss_fight_runs
     SET updated_at = ?, completed_at = ?, decision_count = ?, payload = ?
     WHERE id = ? AND decision_count = ? AND payload = ?`,
  ).bind(
    run.updatedAt,
    run.completedAt,
    run.state.decisions.length,
    JSON.stringify(run),
    run.id,
    existing.state.decisions.length,
    JSON.stringify(existing),
  ).run();
  const saved = await findRun(database, run.id);
  if (!saved) return response({ error: "Stored Boss Fight run is invalid" }, 500);
  if (result.meta?.changes === 1 || compareBossFightRuns(saved, run) === "same") {
    return response({ run: saved, stored: true, storage: "d1" });
  }
  return response({ run: saved, stored: false, storage: "d1", error: "Run changed on another device" }, 409);
}
