import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { PUT, saveBossFightRunToDatabase } from "../../app/api/boss-fights/route";
import type { D1Database } from "../../app/api/boss-fights/route";
import { getBossFightView, validateBossFightScenario } from "./engine";
import {
  advanceBossFightRun,
  createBossFightRun,
  loadBossFightRuns,
  rememberBossFightRun,
  saveBossFightRun,
  validateBossFightRun,
} from "./persistence";
import { compareBossFightRuns } from "./run";
import { ruleCopyBossFight } from "./scenario";

type SqliteStatement = {
  all: (...values: unknown[]) => unknown[];
  get: (...values: unknown[]) => Record<string, unknown> | undefined;
  run: (...values: unknown[]) => { changes: number };
};
const { DatabaseSync } = createRequire(`${process.cwd()}/package.json`)("node:sqlite") as {
  DatabaseSync: new (path: string) => {
    exec: (sql: string) => void;
    prepare: (sql: string) => SqliteStatement;
    close: () => void;
  };
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function verify() {
  assert(validateBossFightScenario(ruleCopyBossFight).length === 0, "Authored scenario graph is invalid");
  const startedAt = "2026-09-23T12:00:00.000Z";
  const run = createBossFightRun(ruleCopyBossFight, "run-one", startedAt);
  assert(validateBossFightRun(run, ruleCopyBossFight).length === 0, "Fresh run is invalid");
  const ownership = advanceBossFightRun(ruleCopyBossFight, run, "pinned-input", "2026-09-23T12:01:00.000Z");
  const scale = advanceBossFightRun(ruleCopyBossFight, ownership, "async-job", "2026-09-23T12:02:00.000Z");
  const retry = advanceBossFightRun(ruleCopyBossFight, scale, "same-job", "2026-09-23T12:03:00.000Z");
  const completed = advanceBossFightRun(ruleCopyBossFight, retry, "reconcile-resume", "2026-09-23T12:04:00.000Z");
  assert(completed.completedAt === completed.updatedAt, "Graph completion did not set completion time");
  assert(run.state.decisions.length === 0, "Advancement mutated previous run");
  assert(compareBossFightRuns(run, ownership) === "advance", "Append was not recognized");
  assert(compareBossFightRuns(ownership, run) === "stale", "Stale prefix was not recognized");
  assert(compareBossFightRuns(completed, completed) === "same", "Idempotent save was not recognized");
  const alternate = advanceBossFightRun(ruleCopyBossFight, run, "live-chunks", "2026-09-23T12:01:00.000Z");
  assert(compareBossFightRuns(ownership, alternate) === "diverged", "Concurrent branch was not rejected");
  const alternateRetry = advanceBossFightRun(ruleCopyBossFight,
    advanceBossFightRun(ruleCopyBossFight, alternate, "async-job", "2026-09-23T12:02:00.000Z"),
    "same-job", "2026-09-23T12:03:00.000Z");
  const stableContext = getBossFightView(ruleCopyBossFight, retry.state)?.context.join(" ") ?? "";
  const changedContext = getBossFightView(ruleCopyBossFight, alternateRetry.state)?.context.join(" ") ?? "";
  assert(stableContext !== changedContext && changedContext.includes("changed source"), "Earlier input choice did not change recovery constraint");
  assert(validateBossFightRun({ ...completed, completedAt: null }, ruleCopyBossFight).length > 0, "Missing completion marker was accepted");
  assert(validateBossFightRun({ ...run, completedAt: startedAt }, ruleCopyBossFight).length > 0, "Early completion marker was accepted");
  assert(validateBossFightRun({ ...run, state: { ...run.state, scenarioVersion: 99 } }, ruleCopyBossFight).length > 0, "Outdated state was accepted");
  assert(validateBossFightRun({ ...run, state: { ...run.state, decisions: [{ stageId: "recover-async", choiceId: "retry-forever" }] } }, ruleCopyBossFight).length > 0, "Skipped stage was accepted");
  const replay = createBossFightRun(ruleCopyBossFight, "run-two", "2026-09-23T12:05:00.000Z");
  assert(replay.id !== completed.id && replay.state.decisions.length === 0, "Replay overwrote completed run");

  const invalidResponse = await PUT(new Request("http://localhost/api/boss-fights", {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...run, completedAt: startedAt }),
  }));
  assert(invalidResponse.status === 400, "API accepted invalid run");

  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync("migrations/0003_boss_fight_runs.sql", "utf8"));
  const database: D1Database = {
    prepare: (sql) => {
      const statement = sqlite.prepare(sql);
      let values: unknown[] = [];
      const bound = {
        bind: (...next: unknown[]) => { values = next; return bound; },
        all: async () => ({ results: statement.all(...values) }),
        first: async () => statement.get(...values) ?? null,
        run: async () => ({ meta: { changes: statement.run(...values).changes } }),
      };
      return bound;
    },
  };
  try {
    const first = await saveBossFightRunToDatabase(database, run);
    assert(first.status === 201, "Initial D1 run was not created");
    const firstAdvance = await saveBossFightRunToDatabase(database, ownership);
    assert(firstAdvance.status === 200, "D1 advance failed");
    const repeat = await saveBossFightRunToDatabase(database, ownership);
    assert(repeat.status === 200, "Idempotent D1 retry failed");
    const staleWrite = await saveBossFightRunToDatabase(database, run);
    assert(staleWrite.status === 409, "D1 accepted stale prefix");
    const divergentWrite = await saveBossFightRunToDatabase(database, alternate);
    assert(divergentWrite.status === 409, "D1 accepted concurrent divergent choice");
    const serverRun = (await divergentWrite.json() as { run: typeof run }).run;
    assert(serverRun.state.decisions[0].choiceId === "pinned-input", "Conflict did not return canonical D1 run");
    const finish = await saveBossFightRunToDatabase(database, completed);
    assert(finish.status === 200, "D1 rejected valid append-only completion");
    const afterFinish = await saveBossFightRunToDatabase(database, ownership);
    assert(afterFinish.status === 409, "D1 completion was overwritten by stale progress");
    const secondRun = await saveBossFightRunToDatabase(database, replay);
    assert(secondRun.status === 201, "Replay did not create another D1 row");
    assert(sqlite.prepare("SELECT COUNT(*) AS count FROM boss_fight_runs").get()?.count === 2, "Replay overwrote D1 history");
  } finally {
    sqlite.close();
  }

  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    },
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("offline"); };
  try {
    const immediate = rememberBossFightRun(completed);
    assert(!immediate.conflict && values.size === 1, "Synchronous local write did not finish before network work");
    const saved = await saveBossFightRun(completed);
    assert(saved.storage === "local", "Offline save did not fall back locally");
    const loaded = await loadBossFightRuns();
    assert(loaded.runs.length === 1 && loaded.runs[0].id === completed.id, "Reload lost offline progress");
    const stale = await saveBossFightRun(run);
    assert(stale.conflict && stale.run.state.decisions.length === 4, "Local stale write erased progress");
    const second = await saveBossFightRun(replay);
    assert(!second.conflict, "Replay was rejected");
    assert((await loadBossFightRuns()).runs.length === 2, "Replay replaced prior history");

    const raceStart = createBossFightRun(ruleCopyBossFight, "race-run", "2026-09-23T13:00:00.000Z");
    const raceOne = advanceBossFightRun(ruleCopyBossFight, raceStart, "pinned-input", "2026-09-23T13:01:00.000Z");
    const raceTwo = advanceBossFightRun(ruleCopyBossFight, raceOne, "async-job", "2026-09-23T13:02:00.000Z");
    const raceThree = advanceBossFightRun(ruleCopyBossFight, raceTwo, "same-job", "2026-09-23T13:03:00.000Z");
    let releaseResponse: ((response: Response) => void) | undefined;
    globalThis.fetch = async () => new Promise<Response>((resolve) => { releaseResponse = resolve; });
    const inFlight = saveBossFightRun(raceTwo);
    assert(releaseResponse, "Save request did not enter the in-flight state");
    rememberBossFightRun(raceThree);
    releaseResponse(Response.json({ run: raceOne, storage: "d1" }, { status: 409 }));
    const staleConflict = await inFlight;
    assert(staleConflict.storage === "local" && staleConflict.run.state.decisions.length === 3, "Stale 409 regressed returned local progress");
    const savedRuns = JSON.parse(values.get("interdojo-boss-fight-runs-v1") ?? "[]") as (typeof run)[];
    assert(savedRuns.find((item) => item.id === raceStart.id)?.state.decisions.length === 3, "Stale 409 regressed durable local progress");

    const otherBranch = advanceBossFightRun(ruleCopyBossFight, raceStart, "live-chunks", "2026-09-23T13:01:00.000Z");
    let releaseDivergence: ((response: Response) => void) | undefined;
    globalThis.fetch = async () => new Promise<Response>((resolve) => { releaseDivergence = resolve; });
    const divergentSave = saveBossFightRun(raceThree);
    assert(releaseDivergence, "Divergent save request did not start");
    releaseDivergence(Response.json({ run: otherBranch, storage: "d1" }, { status: 409 }));
    const divergentConflict = await divergentSave;
    assert(divergentConflict.storage === "d1" && divergentConflict.run.state.decisions[0].choiceId === "live-chunks", "Divergent server branch was not adopted");
    const reconciled = JSON.parse(values.get("interdojo-boss-fight-runs-v1") ?? "[]") as (typeof run)[];
    assert(reconciled.find((item) => item.id === raceStart.id)?.state.decisions[0].choiceId === "live-chunks", "Divergent server branch was not stored locally");
  } finally {
    globalThis.fetch = originalFetch;
    Reflect.deleteProperty(globalThis, "localStorage");
  }
  console.log("Boss Fight persistence verified: authored paths, completion, replay, stale writes, invalid payloads, and offline reload.");
}

void verify();
