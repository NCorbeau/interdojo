import type { BossFightScenario } from "./types";

/**
 * A hypothetical scale-up of the documented rule-copy work. The shipped API
 * was synchronous, transactional, capped, and non-idempotent; none of the job
 * machinery below is presented as shipped history.
 *
 * Design sources:
 * https://app.notion.com/p/3e0e60f718a9813facc4f533f2cf1803
 * https://app.notion.com/p/3e0e60f718a9814fbceec83ebd05676c
 * History boundary:
 * https://app.notion.com/p/3dde60f718a981cea77feae7ee8acd4d
 */
export const ruleCopyBossFight: BossFightScenario = {
  id: "rule-copy-under-pressure",
  version: 1,
  title: "The Copy That Might Have Finished",
  estimatedMinutes: 10,
  source: {
    title: "Distributed Systems & Async Work — Study Guide",
    url: "https://app.notion.com/p/3e0e60f718a9813facc4f533f2cf1803",
  },
  startStageId: "ownership",
  stages: [
    {
      id: "ownership",
      title: "1 · Choose the source of truth",
      prompt:
        "Hypothetical extension: copy a graph of recommendation rules, conditions, and actions from one organization to another. The source may be edited while a large copy runs. The target must never mix organizations or contain a half-mapped graph. Before choosing, identify which data owns the copy's identity and input.",
      choices: [
        {
          id: "pinned-input",
          label:
            "Authorize both organizations, persist one copy request and immutable source snapshot, then map source IDs to target IDs from it.",
          feedback:
            "The operation has a stable identity and input. A later retry can compare against the same graph, while target writes still need their own duplicate guard.",
          nextStageId: "scale",
        },
        {
          id: "live-chunks",
          label:
            "Read source rows afresh for each write batch; keep the ID mapping only in the running process.",
          feedback:
            "This uses less setup, but a source edit or process restart can change the graph and lose the mapping halfway through a copy.",
          nextStageId: "scale",
        },
      ],
    },
    {
      id: "scale",
      title: "2 · Load changes the shape",
      prompt:
        "A new customer has thousands of nested rules. A copy may take minutes, users close the tab, and one busy organization could crowd out others. Think through what the user sees while waiting and where you would limit work. Which design do you take forward?",
      context: [
        {
          when: { stageId: "ownership", choiceId: "pinned-input" },
          text: "Your recorded request and fixed source input can travel with the work.",
        },
        {
          when: { stageId: "ownership", choiceId: "live-chunks" },
          text: "Your source reads and ID map still depend on the process staying alive; a longer run increases that exposure.",
        },
      ],
      choices: [
        {
          id: "sync-cap",
          label:
            "Keep one synchronous database transaction, reject copies above a preflight cap, and return a clear size error.",
          feedback:
            "The cap bounds accepted work and one transaction keeps its graph atomic. Large copies remain unavailable, and a lost HTTP response can still hide a committed result.",
          nextStageId: "retry-sync",
        },
        {
          id: "async-job",
          label:
            "Persist a copy job, return its ID, stage bounded target chunks behind a publish gate, and expose status with per-organization limits.",
          feedback:
            "The copy survives a closed tab and capacity can be controlled. Chunk commits now make partial results, duplicate execution, and recovery explicit design work.",
          nextStageId: "retry-async",
        },
      ],
    },
    {
      id: "retry-sync",
      title: "3 · The HTTP timeout",
      prompt:
        "A copy under the cap times out at the gateway. The database might have committed the full graph, but the caller received no answer. Support asks whether to press Copy again. What do you do before another apply?",
      context: [
        {
          when: { stageId: "ownership", choiceId: "pinned-input" },
          text: "You have a request identity and fixed input to use while checking the target outcome.",
        },
        {
          when: { stageId: "ownership", choiceId: "live-chunks" },
          text: "Your in-process mapping is gone; a fresh request may read a different source graph.",
        },
      ],
      choices: [
        {
          id: "inspect-outcome",
          label:
            "Inspect target state and any request record; if the result cannot be identified, stop automated retry for deliberate repair.",
          feedback:
            "A timeout proves neither rollback nor commit. An absent operation record makes safe automatic retry harder, so keep the unknown result visible.",
          nextStageId: "recover-sync",
        },
        {
          id: "blind-retry",
          label:
            "Send the same non-idempotent apply request again immediately and assume the first transaction rolled back.",
          feedback:
            "If the first transaction committed, the second may create another graph. The caller's timeout did not roll back database work.",
          nextStageId: "recover-sync",
        },
      ],
    },
    {
      id: "retry-async",
      title: "3 · The worker loses its answer",
      prompt:
        "A worker commits one target chunk, then dies before it records progress or acknowledges the work. Another worker receives that chunk. Consider which part may repeat and which business result must remain singular.",
      context: [
        {
          when: { stageId: "ownership", choiceId: "pinned-input" },
          text: "The job can still refer to the same source snapshot after a worker dies.",
        },
        {
          when: { stageId: "ownership", choiceId: "live-chunks" },
          text: "A source edit happened during the run; a retry could now read different rule content.",
        },
      ],
      choices: [
        {
          id: "same-job",
          label:
            "Retry under the same job ID; enforce unique source-to-target mappings and reconcile committed chunks before advancing progress.",
          feedback:
            "Delivery can repeat, but durable uniqueness converges on the same target IDs. Progress must reflect committed work; content still needs a fixed input.",
          nextStageId: "recover-async",
        },
        {
          id: "new-job",
          label:
            "Start a fresh job for the remaining work and trust the queue to execute each chunk once.",
          feedback:
            "The queue can redeliver after commit-before-ack. A new job identity also loses the link to already-written target nodes, risking duplicates.",
          nextStageId: "recover-async",
        },
      ],
    },
    {
      id: "recover-sync",
      title: "4 · Recover the unknown result",
      prompt:
        "The API process failed after the database decision but before the UI received a result. The target has rules, the source has since changed, and support needs a trustworthy answer. Decide what can be confirmed, then choose a recovery path.",
      context: [
        {
          when: { stageId: "retry-sync", choiceId: "inspect-outcome" },
          text: "You paused a second apply while examining the committed target graph.",
        },
        {
          when: { stageId: "retry-sync", choiceId: "blind-retry" },
          text: "A second apply may already have created duplicate target rules; the result must be reconciled before another attempt.",
        },
        {
          when: { stageId: "ownership", choiceId: "live-chunks" },
          text: "Without a fixed source snapshot, a new attempt cannot be assumed to reproduce the original input.",
        },
      ],
      choices: [
        {
          id: "reconcile-sync",
          label:
            "Compare target records with the original request if available, repair any duplicate graph deliberately, and record a result before retry.",
          feedback:
            "The transaction kept each accepted apply atomic, but the caller's outcome remained uncertain. Reconciliation restores a known result without erasing unrelated target data.",
          nextStageId: null,
        },
        {
          id: "wipe-and-rerun",
          label:
            "Delete the target organization's rules and rerun the copy from the source's current state.",
          feedback:
            "That can erase unrelated target work and copy a different source version. Recovery needs to identify this operation's effects first.",
          nextStageId: null,
        },
      ],
    },
    {
      id: "recover-async",
      title: "4 · Recover partial work",
      prompt:
        "Several chunks are committed. The worker lease expires, queue age rises, and the UI still says Running. A source rule changes while support investigates. Consider what a replacement worker may safely do and what the user should see.",
      context: [
        {
          when: { stageId: "retry-async", choiceId: "same-job" },
          text: "The same job identity and durable mapping let a new worker inspect already-committed chunks.",
        },
        {
          when: { stageId: "retry-async", choiceId: "new-job" },
          text: "The fresh job has no reliable link to the earlier chunk's target IDs; duplicate work may already exist.",
        },
        {
          when: { stageId: "ownership", choiceId: "live-chunks" },
          text: "The changed source may make later chunks inconsistent with earlier ones unless the input is frozen or reconciled.",
        },
      ],
      choices: [
        {
          id: "reconcile-resume",
          label:
            "Reclaim the job and inspect committed mappings; resume from pinned input only if consistent, otherwise mark failed for owned repair.",
          feedback:
            "A lease permits takeover, not rollback of old writes. Reconcile durable chunks before publishing; if the input changed, stop and repair instead of mixing versions.",
          nextStageId: null,
        },
        {
          id: "retry-forever",
          label:
            "Keep retrying all chunks immediately until the queue empties; leave the UI at Running meanwhile.",
          feedback:
            "Unlimited retries can amplify overload and hide a permanent error. A bounded retry budget, failure state, and operator-owned replay are needed.",
          nextStageId: null,
        },
      ],
    },
  ],
  debrief: [
    {
      id: "retry-lesson",
      topic: "retries",
      text:
        "A timeout or lost acknowledgment is an unknown outcome, not proof of failure. Retry transient faults with backoff, jitter, and a budget only after the operation is safe to repeat.",
    },
    {
      id: "identity-lesson",
      topic: "idempotency",
      text:
        "Keep one operation identity and a durable, uniqueness-protected mapping from each source node to its target node. A read-then-insert check alone can race; repeated work must converge on one graph.",
    },
    {
      id: "consistency-lesson",
      topic: "consistency",
      text:
        "Protect tenant ownership and a fixed source snapshot at the authoritative data boundary. Progress UI can lag; the identity and content of a completed target graph cannot be guessed from stale status.",
    },
    {
      id: "recovery-lesson",
      topic: "recovery",
      text:
        "After failure, inspect committed effects, resume or repair the same logical operation, and expose a terminal failed state with an owner. Publish no partial target graph; cancellation and lease expiry do not undo writes.",
    },
    {
      id: "pinned-held",
      topic: "consistency",
      when: { stageId: "ownership", choiceId: "pinned-input" },
      text: "Your fixed source snapshot held: a later retry could target the same input, provided target writes were also duplicate-safe.",
    },
    {
      id: "live-broke",
      topic: "consistency",
      when: { stageId: "ownership", choiceId: "live-chunks" },
      text: "Your live reads risked a mixed-version graph when the source changed. Freeze the input or explicitly detect and restart after a version conflict.",
    },
    {
      id: "sync-tradeoff",
      topic: "recovery",
      when: { stageId: "scale", choiceId: "sync-cap" },
      text: "The synchronous transaction kept each accepted copy atomic, while the cap rejected the larger case. A lost response still required outcome lookup before retry.",
    },
    {
      id: "async-tradeoff",
      topic: "recovery",
      when: { stageId: "scale", choiceId: "async-job" },
      text: "The job survived disconnects and admitted larger copies, but chunk commits made partial results normal. Durable progress and reconciliation became part of correctness.",
    },
    {
      id: "blind-retry-cost",
      topic: "idempotency",
      when: { stageId: "retry-sync", choiceId: "blind-retry" },
      text: "The blind second apply may have duplicated a fully committed graph. Inspect and repair its exact effects before another apply.",
    },
    {
      id: "new-job-cost",
      topic: "idempotency",
      when: { stageId: "retry-async", choiceId: "new-job" },
      text: "The fresh job lost the original operation identity. Reattach the committed mapping or quarantine the result before continuing.",
    },
  ],
};
