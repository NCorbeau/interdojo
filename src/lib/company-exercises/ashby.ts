import { defineCompanyExercises } from "./types";
import { companySources } from "../sources";
import type { Exercise } from "../domain";

const ashbySource = companySources.ashby;

const interviewExercises: Exercise[] = [
  {
    id: "ashby-why-structure",
    skillId: "company-motivation",
    track: "interview" as const,
    type: "anchor-reconstruction" as const,
    evidenceLevel: "apply",
    eyebrow: "Why Ashby",
    prompt: "Reconstruct a concise, evidence-based answer to “Why Ashby?”",
    instruction: "Choose only the essential anchors, in speaking order.",
    anchors: [
      { id: "product", label: "Them: a specific product or craft signal" },
      { id: "evidence", label: "Me: direct evidence of fit" },
      { id: "timing", label: "Timing: why this match matters now" },
      { id: "generic", label: "Generic praise that could fit any startup" },
      { id: "resume", label: "A complete chronology of every role" },
    ],
    correctOrder: ["product", "evidence", "timing"],
    explanation: "The strongest answer moves from Ashby-specific signal to credible personal evidence and then to timing. Generic enthusiasm and a resume recital do not establish fit.",
    tags: ["company-motivation", "career-narrative"],
    answerExamples: [
      {
        id: "ashby-why-example",
        label: "Example",
        answer: "Ashby stands out to me because the combination is unusually coherent: strong product engineering, a high bar for engineers owning problems end to end, and one of the clearest public examples I’ve seen of AI being integrated into the engineering operating model rather than added on top. That maps well to how I’ve worked—repeatedly turning broad product intent into detailed behavior or design under strong review, carrying complex cross-stack workflows at Kalepa, and building architectural foundations at Appfire that enabled later work. After Kalepa, I also know I want AI to be part of normal engineering practice, so Ashby is particularly interesting to me now.",
        companyId: "ashby" as const,
        source: ashbySource,
      },
    ],
    source: ashbySource,
    companyId: "ashby" as const,
  },
  {
    id: "ashby-why-proof-selection",
    skillId: "company-motivation",
    track: "interview" as const,
    type: "choice" as const,
    evidenceLevel: "recognize",
    eyebrow: "Why Ashby proof",
    prompt: "Which evidence best supports a claim that you would thrive in Ashby's product-engineering environment?",
    instruction: "Choose the most persuasive evidence.",
    options: [
      { id: "workflow", label: "A concrete example of simplifying a complex customer workflow end to end, including trade-offs and outcome" },
      { id: "interest", label: "A statement that you enjoy fast-moving startups" },
      { id: "tools", label: "A list of every framework and database you have used" },
      { id: "prestige", label: "The recognizable names of previous employers" },
    ],
    correctOptionId: "workflow",
    explanation: "A specific story showing product judgment, technical ownership and an outcome is stronger evidence than enthusiasm, tool inventory or employer prestige. It should be true, bounded and easy to probe.",
    tags: ["company-motivation", "claim-boundaries", "behavioral"],
    answerExamples: [
      {
        id: "ashby-proof-example",
        label: "Proof shape",
        answer: "I would use one story where I clarified the workflow, chose a simple boundary, carried the change through UI, API and persistence, and can explain what improved and what I would change next. That gives Ashby evidence of both execution and judgment without claiming ownership I did not have.",
        companyId: "ashby" as const,
        source: ashbySource,
      },
    ],
    source: ashbySource,
    companyId: "ashby" as const,
  },
  {
    id: "ashby-why-boundary-probe",
    skillId: "claim-boundaries",
    track: "interview" as const,
    type: "anchor-reconstruction" as const,
    evidenceLevel: "apply",
    eyebrow: "Defensible claim",
    prompt: "Build a defensible answer when asked how your experience maps to Ashby's needs.",
    instruction: "Arrange the anchors in the order that keeps the claim strong and probeable.",
    anchors: [
      { id: "scope", label: "State the exact scope you owned" },
      { id: "decision", label: "Explain one consequential decision and trade-off" },
      { id: "evidence", label: "Give an observable outcome or artifact" },
      { id: "boundary", label: "Name what you did not own and how you collaborated" },
      { id: "inflate", label: "Round up adjacent exposure into direct ownership" },
    ],
    correctOrder: ["scope", "decision", "evidence", "boundary"],
    explanation: "A credible senior claim has a clear scope, a decision, evidence and an explicit boundary. Naming collaboration or adjacent exposure increases trust; inflating it creates an easy failure under probing.",
    tags: ["claim-boundaries", "company-motivation", "behavioral"],
    answerExamples: [
      {
        id: "ashby-boundary-example",
        label: "Defensible phrasing",
        answer: "I owned the frontend architecture and coordinated the API contract with the service owner. I made the state-ownership decision, measured the workflow after rollout, and can speak to the trade-offs. I did not own the backend deployment or product prioritization, so I would describe those as close collaboration rather than sole ownership.",
        companyId: "ashby" as const,
        source: ashbySource,
      },
    ],
    source: ashbySource,
    companyId: "ashby" as const,
  },
];

export const ashbyExerciseModule = defineCompanyExercises(
  "ashby",
  interviewExercises,
);
