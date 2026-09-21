import type { CompletedSession } from "@/lib/domain";

type D1Statement = {
  bind: (...values: unknown[]) => D1Statement;
  all: () => Promise<{ results?: unknown[] }>;
  run: () => Promise<unknown>;
};

type D1Database = {
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

function isCompletedSession(value: unknown): value is CompletedSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CompletedSession>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length <= 100 &&
    (candidate.mode === "daily" ||
      candidate.mode === "engineering" ||
      candidate.mode === "interview") &&
    typeof candidate.startedAt === "string" &&
    typeof candidate.completedAt === "string" &&
    Array.isArray(candidate.attempts) &&
    candidate.attempts.length > 0 &&
    candidate.attempts.length <= 20
  );
}

export async function GET() {
  const database = await getDatabase();
  if (!database) {
    return Response.json({ sessions: [], storage: "local" });
  }

  const result = await database
    .prepare(
      `SELECT payload
       FROM sessions
       ORDER BY completed_at DESC
       LIMIT 30`,
    )
    .all();

  const sessions = (result.results ?? [])
    .map((row) => {
      try {
        return JSON.parse((row as { payload: string }).payload) as CompletedSession;
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return Response.json({ sessions, storage: "d1" });
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isCompletedSession(body)) {
    return Response.json({ error: "Invalid session payload" }, { status: 400 });
  }

  const database = await getDatabase();
  if (!database) {
    return Response.json({ stored: false, storage: "local" }, { status: 202 });
  }

  const score = body.attempts.filter((attempt) => attempt.correct).length;
  await database
    .prepare(
      `INSERT INTO sessions (
        id, mode, started_at, completed_at, score, total, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING`,
    )
    .bind(
      body.id,
      body.mode,
      body.startedAt,
      body.completedAt,
      score,
      body.attempts.length,
      JSON.stringify(body),
    )
    .run();

  return Response.json({ stored: true, storage: "d1" }, { status: 201 });
}
