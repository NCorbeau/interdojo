import { defineCompanyExercises } from "./types";
import type { Exercise } from "../domain";
import { companySources } from "../sources";

const linearSource = companySources.linear;

export const linearFocusExercises: Exercise[] = [
  {
    id: "linear-why-structure",
    skillId: "company-motivation",
    track: "interview",
    type: "anchor-reconstruction",
    evidenceLevel: "apply",
    eyebrow: "Why Linear",
    prompt: "Reconstruct a focused 30–60 second answer for why Linear is compelling.",
    instruction: "Choose the essential anchors in speaking order; leave distractors unused.",
    anchors: [
      { id: "them", label: "Them: product/interaction quality and engineers following problems across boundaries" },
      { id: "me", label: "Me: Appfire architecture and Kalepa cross-stack workflow evidence" },
      { id: "timing", label: "Timing: use frontend architecture depth as leverage inside broader Staff scope" },
      { id: "ranking", label: "Recite the full company ranking and research process" },
      { id: "generic", label: "Use generic praise that could fit any startup" },
    ],
    correctOrder: ["them", "me", "timing"],
    explanation: "The answer card's structure is them → me → timing. Lead with Linear's specific product-engineering signal, connect it to concrete evidence, and explain why the scope is right now; ranking context is supporting material, not the answer.",
    answerExamples: [{ id: "canonical", label: "Canonical", answer: "Linear is compelling because product quality seems to be treated as an engineering concern, not just a design concern. A lot of my work has been exactly at that boundary—taking broad or complex requirements and turning them into coherent product behavior. At Kuehne+Nagel I scoped rough business visions and proposed interaction designs; at Kalepa I often clarified detailed requirements or proposed designs before iterating with Product and a lead designer; and at Appfire I connected resource-planning architecture directly to how the product behaved. I also like that the role appears to value engineers who follow the problem rather than staying inside one layer, which is how I want to operate at Staff scope.", companyId: "linear", source: linearSource }],
    companyId: "linear",
    tags: ["company-motivation", "career-narrative", "staff-judgment"],
    source: linearSource,
  },
  {
    id: "linear-proof-selection",
    skillId: "company-motivation",
    track: "interview",
    type: "choice",
    evidenceLevel: "recognize",
    eyebrow: "Proof selection",
    prompt: "When explaining fit for Linear's product-engineering bar, which proof should lead?",
    instruction: "Choose the strongest proof choice.",
    options: [
      { id: "appfire", label: "Appfire's grid/grouping architecture, framed as turning domain constraints into coherent product behavior" },
      { id: "inventory", label: "A long inventory of every frontend library used across the last decade" },
      { id: "title", label: "A claim that Staff scope follows automatically from years of experience" },
      { id: "generic", label: "Generic enthusiasm for polished products without a concrete example" },
    ],
    correctOptionId: "appfire",
    explanation: "The primary proof map is the Appfire grid/grouping architecture, with Kalepa cross-stack workflows as complementary evidence. The point is architecture as product leverage, not framework trivia or an unsupported title claim.",
    answerExamples: [{ id: "proof", label: "Proof phrasing", answer: "At Appfire, I reshaped the architecture behind a resource-planning grid so it preserved user context and made grouping and filtering practical. That is the kind of work where the boundary between architecture and product behavior matters most.", companyId: "linear", source: linearSource }],
    companyId: "linear",
    tags: ["company-motivation", "claim-boundaries", "staff-judgment", "interaction-quality"],
    source: linearSource,
  },
  {
    id: "linear-boundary-probe",
    skillId: "claim-boundaries",
    track: "interview",
    type: "choice",
    evidenceLevel: "recognize",
    eyebrow: "Defensible boundary",
    prompt: "If asked whether frontend is your main scope boundary, which answer is strongest and most defensible?",
    instruction: "Choose the best answer.",
    options: [
      { id: "leverage", label: "Frontend architecture is a force multiplier; I follow the problem across domain, API and data boundaries when that is what the product needs" },
      { id: "frontend-only", label: "I stay in frontend because backend and product decisions are outside my scope" },
      { id: "overclaim", label: "I am equally deep in every backend and infrastructure area, so there is no boundary at all" },
      { id: "evade", label: "I would avoid the question and return to discussing React implementation details" },
    ],
    correctOptionId: "leverage",
    explanation: "The Linear answer card explicitly treats frontend depth as leverage rather than a scope boundary. Be ready to discuss current React evidence honestly while demonstrating broader Staff influence; do not overclaim uniform depth across every domain.",
    answerExamples: [{ id: "boundary", label: "Boundary phrasing", answer: "Frontend architecture is where I have some of my deepest leverage, but I do not want it to define the boundary of my scope. I am most effective when I carry a product problem through its domain model, APIs, data and interaction, bringing in the right specialists where depth is needed.", companyId: "linear", source: linearSource }],
    companyId: "linear",
    tags: ["claim-boundaries", "staff-judgment", "career-narrative"],
    source: linearSource,
  },
];

export const linearExerciseModule = defineCompanyExercises("linear", linearFocusExercises);
