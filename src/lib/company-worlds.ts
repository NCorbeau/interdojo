import type { CompanyId, CompanyWorld } from "./domain";
import { companySources } from "./sources";

export const companyWorlds = [
  {
    id: "ashby",
    name: "Ashby",
    description: "Product engineering across React, TypeScript, APIs and Node.",
    focusAreas: ["React & TypeScript", "API-backed UI", "Node", "Product judgment"],
    source: companySources.ashby,
    tagWeights: {
      "react-typescript": 6,
      "api-backed-ui": 5,
      "node-runtime": 5,
      "product-judgment": 4,
      "ai-assisted-engineering": 3,
      "company-motivation": 5,
    },
    standard: {
      size: 7,
      trackCounts: { engineering: 5, interview: 2 },
    },
    rapidFire: {
      size: 5,
      trackCounts: { engineering: 3, interview: 2 },
    },
  },
  {
    id: "attio",
    name: "Attio",
    description: "Flexible domain models, data APIs and Staff-level judgment.",
    focusAreas: ["Domain modeling", "APIs & data", "Transactions", "Staff judgment"],
    source: companySources.attio,
    tagWeights: {
      "domain-modeling": 6,
      "api-data": 5,
      transactions: 5,
      "staff-judgment": 5,
      "product-judgment": 3,
      "company-motivation": 5,
    },
    standard: {
      size: 7,
      trackCounts: { engineering: 5, interview: 2 },
    },
    rapidFire: {
      size: 5,
      trackCounts: { engineering: 3, interview: 2 },
    },
  },
  {
    id: "linear",
    name: "Linear",
    description: "State architecture, realtime systems and interaction quality.",
    focusAreas: ["State architecture", "Realtime", "Performance", "Interaction quality"],
    source: companySources.linear,
    tagWeights: {
      "state-architecture": 6,
      realtime: 5,
      performance: 5,
      "interaction-quality": 5,
      "product-judgment": 4,
      "company-motivation": 5,
    },
    standard: {
      size: 7,
      trackCounts: { engineering: 5, interview: 2 },
    },
    rapidFire: {
      size: 5,
      trackCounts: { engineering: 3, interview: 2 },
    },
  },
] satisfies CompanyWorld[];

const companyWorldById = new Map(
  companyWorlds.map((world) => [world.id, world]),
);

export function getCompanyWorld(companyId: CompanyId): CompanyWorld {
  const world = companyWorldById.get(companyId);
  if (!world) {
    throw new Error(`Unknown company world: ${companyId}`);
  }
  return world;
}
