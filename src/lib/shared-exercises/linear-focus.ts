import type { Exercise } from "../domain";
import { technicalSources } from "../sources";

const frontendArchitectureSource = technicalSources.frontendArchitecture;
const reactSource = technicalSources.react;
const browserSource = technicalSources.browserPlatform;

/** Shared drills that emphasize the product-engineering judgment Linear is likely to probe. */
export const linearFocusExercises: Exercise[] = [
  {
    id: "shared-linear-state-owner",
    skillId: "frontend-architecture",
    track: "engineering",
    type: "multi-select",
    eyebrow: "State architecture",
    prompt:
      "You are designing an editable, filterable resource grid. Which decisions establish a sound state architecture?",
    instruction: "Select every decision that belongs.",
    options: [
      { id: "canonical", label: "Name one canonical owner for each durable domain fact" },
      { id: "derived", label: "Derive filtered rows from canonical data instead of synchronizing a second copy" },
      { id: "local-ui", label: "Keep selection, draft text and modal state local to the feature when possible" },
      { id: "global-all", label: "Put every grid value in a global store so components can access it" },
      { id: "effects-sync", label: "Use effects to keep duplicated filtered and canonical arrays synchronized" },
    ],
    correctOptionIds: ["canonical", "derived", "local-ui"],
    explanation:
      "Start with ownership and invariants: remote data has a clear source of truth, derived views are computed, and ephemeral interaction state stays near the workflow that owns it. A global store or synchronization effects can hide ownership problems and broaden invalidation.",
    tags: ["state-architecture", "interaction-quality", "product-judgment"],
    source: frontendArchitectureSource,
  },
  {
    id: "shared-linear-realtime-reconcile",
    skillId: "distributed-systems",
    track: "engineering",
    type: "ordering",
    eyebrow: "Realtime reconciliation",
    prompt:
      "A collaborative grid loads a snapshot, receives events, and can reconnect after missing messages. Order the safest update flow.",
    instruction: "Arrange the steps from first to last.",
    items: [
      { id: "snapshot", label: "Load an authoritative initial snapshot" },
      { id: "metadata", label: "Apply events using version or ordering metadata when available" },
      { id: "detect-gap", label: "Detect reconnect or an uncertain/missing event range" },
      { id: "reconcile", label: "Refetch or reconcile the affected data before trusting the local view" },
      { id: "selective", label: "Update only affected entities and preserve unrelated interaction state" },
    ],
    correctOrder: ["snapshot", "metadata", "selective", "detect-gap", "reconcile"],
    explanation:
      "Realtime streams complement, rather than replace, normal fetch semantics. Apply ordered events narrowly, but after reconnect or uncertainty re-establish authority with a snapshot or targeted reconciliation; never assume an event was not missed.",
    tags: ["realtime", "state-architecture", "distributed-systems", "interaction-quality"],
    source: frontendArchitectureSource,
  },
  {
    id: "shared-linear-performance-diagnosis",
    skillId: "frontend-architecture",
    track: "engineering",
    type: "choice",
    eyebrow: "Performance diagnosis",
    prompt:
      "Typing into one grid cell makes hundreds of rows rerender and input feels slow. What is the strongest first move?",
    instruction: "Choose the strongest answer.",
    options: [
      { id: "profile", label: "Profile the interaction, identify the invalidation path, then partition subscriptions or state around the measured hotspot" },
      { id: "memo", label: "Wrap every component in memo and add callbacks until the symptom disappears" },
      { id: "rewrite", label: "Rewrite the grid in another framework before measuring" },
      { id: "debounce", label: "Debounce all keyboard input, even if it changes editing semantics" },
    ],
    correctOptionId: "profile",
    explanation:
      "Performance is an architectural diagnosis before it is a memoization exercise. Measure whether broad ownership, context/store subscriptions, expensive computation, or data volume causes the work; then reduce invalidation breadth while preserving immediate editing behavior.",
    tags: ["performance", "state-architecture", "react-typescript"],
    source: reactSource,
  },
  {
    id: "shared-linear-optimistic-edit",
    skillId: "react-typescript",
    track: "engineering",
    type: "multi-select",
    eyebrow: "Interaction quality",
    prompt:
      "For an optimistic rename in a collaborative product, which pieces are required for a trustworthy interaction?",
    instruction: "Select every required piece.",
    options: [
      { id: "request-id", label: "Associate the mutation with a request or entity version" },
      { id: "rollback", label: "Define rollback or conflict behavior when the server rejects the change" },
      { id: "feedback", label: "Expose pending, failure and retry feedback without losing the user's context" },
      { id: "reconcile", label: "Reconcile later server responses or realtime events with the provisional value" },
      { id: "hide-errors", label: "Hide errors because optimistic UI should always look successful" },
    ],
    correctOptionIds: ["request-id", "rollback", "feedback", "reconcile"],
    explanation:
      "Optimism improves latency only when provisional state has an identity, a failure policy and a reconciliation path. Good interaction quality preserves focus, selection and context while making conflict or failure legible; it does not pretend the server cannot disagree.",
    tags: ["interaction-quality", "realtime", "state-architecture", "product-judgment"],
    source: reactSource,
  },
  {
    id: "shared-linear-boundary-design",
    skillId: "system-design",
    track: "engineering",
    type: "choice",
    eyebrow: "Product architecture",
    prompt:
      "A team wants to split a product screen into modules. Which is the strongest boundary signal?",
    instruction: "Choose one answer.",
    options: [
      { id: "domain", label: "A coherent domain vocabulary, ownership of invariants and a narrow public API" },
      { id: "same-page", label: "Components happen to appear beside each other on the same page" },
      { id: "same-file", label: "The module is exactly one folder because the folder is easy to find" },
      { id: "framework", label: "The module is defined by whichever framework primitive is newest" },
    ],
    correctOptionId: "domain",
    explanation:
      "Product boundaries should make change and ownership safer: domain behavior, lifecycle, team cadence and explicit dependencies matter more than the current component tree. Good boundaries also create leverage for future capabilities and incremental migration.",
    tags: ["system-design", "state-architecture", "product-judgment"],
    source: frontendArchitectureSource,
  },
  {
    id: "shared-linear-browser-cost",
    skillId: "react-typescript",
    track: "engineering",
    type: "multi-select",
    eyebrow: "Browser responsiveness",
    prompt:
      "A rich screen is slow to interact with. Which measurements help distinguish browser and application causes before changing code?",
    instruction: "Select every useful signal.",
    options: [
      { id: "long-tasks", label: "Long tasks, input responsiveness and scripting time on the main thread" },
      { id: "layout", label: "Layout/paint activity and whether a change forces expensive geometry work" },
      { id: "network", label: "Request waterfall, payload size, cache behavior and server timing" },
      { id: "renders", label: "Component render/invalidation profile and the amount of data rendered" },
      { id: "folklore", label: "Assume transforms or memoization are faster without profiling" },
    ],
    correctOptionIds: ["long-tasks", "layout", "network", "renders"],
    explanation:
      "Responsiveness can be limited by network, server, JavaScript, React/state invalidation, layout/paint, or data volume. The browser and application profiles tell you which boundary to improve; folklore cannot.",
    tags: ["performance", "react-typescript", "interaction-quality"],
    source: browserSource,
  },
];
