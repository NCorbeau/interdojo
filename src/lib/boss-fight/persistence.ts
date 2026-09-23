import { ruleCopyBossFight } from "./scenario";
import { compareBossFightRuns, validateBossFightRun } from "./run";
import type { BossFightRun } from "./run";

export { createBossFightRun, advanceBossFightRun, validateBossFightRun } from "./run";
export type { BossFightRun } from "./run";

const LOCAL_KEY = "interdojo-boss-fight-runs-v1";
const MAX_HISTORY = 30;
export type BossFightStorage = "d1" | "local";

export type BossFightSaveResult = {
  run: BossFightRun;
  storage: BossFightStorage;
  conflict: boolean;
};

function validRuns(value: unknown): BossFightRun[] {
  if (!Array.isArray(value)) return [];
  return value.filter((run): run is BossFightRun => validateBossFightRun(run, ruleCopyBossFight).length === 0);
}

function readLocal(): BossFightRun[] {
  if (typeof localStorage === "undefined") return [];
  try { return validRuns(JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]")); }
  catch { return []; }
}

function writeLocal(runs: BossFightRun[]) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(runs.slice(0, MAX_HISTORY))); }
  catch { /* Browser storage can be unavailable or full; D1 may still succeed. */ }
}

function recent(runs: BossFightRun[]): BossFightRun[] {
  return [...runs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, MAX_HISTORY);
}

function remember(run: BossFightRun): BossFightRun {
  const runs = readLocal();
  const current = runs.find((item) => item.id === run.id);
  if (current) {
    const relation = compareBossFightRuns(current, run);
    if (relation === "stale" || relation === "diverged") return current;
    if (relation === "same") return current;
  }
  writeLocal(recent([run, ...runs.filter((item) => item.id !== run.id)]));
  return run;
}

function reconcileRemoteRun(remote: BossFightRun): { run: BossFightRun; serverCaughtUp: boolean } {
  const local = readLocal();
  const current = local.find((item) => item.id === remote.id);
  if (current) {
    const relation = compareBossFightRuns(current, remote);
    // An older response may arrive after the next choice was already saved locally.
    if (relation === "stale") return { run: current, serverCaughtUp: false };
    if (relation === "same") return { run: current, serverCaughtUp: true };
  }
  writeLocal(recent([remote, ...local.filter((item) => item.id !== remote.id)]));
  return { run: remote, serverCaughtUp: true };
}

/** Synchronous browser write. Call this before queuing any network save. */
export function rememberBossFightRun(run: BossFightRun): { run: BossFightRun; conflict: boolean } {
  const errors = validateBossFightRun(run, ruleCopyBossFight);
  if (errors.length) throw new Error(`Invalid Boss Fight run: ${errors.join("; ")}`);
  const saved = remember(run);
  return { run: saved, conflict: compareBossFightRuns(saved, run) !== "same" };
}

async function putRemote(run: BossFightRun): Promise<BossFightSaveResult> {
  const response = await fetch("/api/boss-fights", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(run),
  });
  const body: unknown = await response.json();
  if (!body || typeof body !== "object") throw new Error("Invalid Boss Fight save response");
  const result = body as Partial<BossFightSaveResult>;
  if (response.status === 409 && validateBossFightRun(result.run, ruleCopyBossFight).length === 0) {
    return { run: result.run!, storage: "d1", conflict: true };
  }
  if (!response.ok) throw new Error(`Boss Fight save failed (${response.status})`);
  if (result.storage === "local") return { run, storage: "local", conflict: false };
  if (result.storage !== "d1" || validateBossFightRun(result.run, ruleCopyBossFight).length) {
    throw new Error("Invalid Boss Fight save response");
  }
  return { run: result.run!, storage: "d1", conflict: false };
}

/** Saves locally before the network request so a short disconnection keeps progress. */
export async function saveBossFightRun(run: BossFightRun): Promise<BossFightSaveResult> {
  const remembered = rememberBossFightRun(run);
  if (remembered.conflict) {
    return { run: remembered.run, storage: "local", conflict: true };
  }
  try {
    const result = await putRemote(run);
    if (result.storage === "d1") {
      const reconciled = reconcileRemoteRun(result.run);
      return { run: reconciled.run, storage: reconciled.serverCaughtUp ? "d1" : "local", conflict: result.conflict };
    }
    return result;
  } catch {
    return { run, storage: "local", conflict: false };
  }
}

/** Merges current D1 history and local unsynced progress, then retries local advances. */
export async function loadBossFightRuns(): Promise<{ runs: BossFightRun[]; storage: BossFightStorage }> {
  const local = readLocal();
  try {
    const response = await fetch("/api/boss-fights", { cache: "no-store" });
    if (!response.ok) throw new Error(`Boss Fight load failed (${response.status})`);
    const body: unknown = await response.json();
    if (!body || typeof body !== "object") throw new Error("Invalid Boss Fight load response");
    const payload = body as { runs?: unknown; storage?: unknown };
    if (payload.storage !== "d1") return { runs: recent(local), storage: "local" };
    const remote = validRuns(payload.runs);
    const merged = new Map(remote.map((run) => [run.id, run]));
    for (const item of local) {
      const existing = merged.get(item.id);
      if (!existing || compareBossFightRuns(existing, item) === "advance") {
        try {
          const result = await putRemote(item);
          merged.set(item.id,
            compareBossFightRuns(item, result.run) === "stale" ? item : result.run);
        } catch {
          // Keep the more advanced local prefix and retry on the next load/save.
          merged.set(item.id, item);
        }
      }
    }
    const runs = recent([...merged.values()]);
    writeLocal(runs);
    return { runs, storage: "d1" };
  } catch {
    return { runs: recent(local), storage: "local" };
  }
}
