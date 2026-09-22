import type { CompanyId, SourceReference } from "./domain";

export const technicalSources = {
  javascriptTypeScript: {
    title: "JavaScript & TypeScript Runtime — Study Guide",
    url: "https://app.notion.com/p/3e0e60f718a981188773ebcc842e79dd",
  },
  react: {
    title: "React, State & Frontend Architecture — Study Guide",
    url: "https://app.notion.com/p/3e0e60f718a9817893acf10c3695ebfa",
  },
  frontendArchitecture: {
    title: "Frontend Architecture & State Modeling — Study Guide",
    url: "https://app.notion.com/p/3e0e60f718a981eeb5b7ed2e6f715b98",
  },
  apiDesign: {
    title: "API Design & Service Boundaries — Study Guide",
    url: "https://app.notion.com/p/3e0e60f718a981a19b95c4d3272e1b82",
  },
  browserPlatform: {
    title: "Browser, HTTP & Web Platform — Study Guide",
    url: "https://app.notion.com/p/3e0e60f718a98195a5bff54bcde2f904",
  },
  domainModeling: {
    title: "Complex Product & Domain Modeling — Study Guide",
    url: "https://app.notion.com/p/3e0e60f718a98152ba12ca57b6c6c327",
  },
  postgres: {
    title: "PostgreSQL, Transactions & Data Modeling — Study Guide",
    url: "https://app.notion.com/p/3e0e60f718a98168a60dccd287448b10",
  },
  distributedSystems: {
    title: "Distributed Systems & Async Work — Study Guide",
    url: "https://app.notion.com/p/3e0e60f718a9813facc4f533f2cf1803",
  },
  node: {
    title: "Node.js & Backend Runtime — Study Guide",
    url: "https://app.notion.com/p/3e0e60f718a9812a9c13d798c63b454a",
  },
  systemDesign: {
    title: "System Design — Study Guide",
    url: "https://app.notion.com/p/3e0e60f718a9814fbceec83ebd05676c",
  },
} satisfies Record<string, SourceReference>;

export const preparationSources = {
  answerBank: {
    title: "Interview Answer Bank",
    url: "https://app.notion.com/p/3e0e60f718a981379164c3fbc583a94b",
  },
  storyBank: {
    title: "Kalepa — Staff Story Bank",
    url: "https://app.notion.com/p/3dde60f718a981cea77feae7ee8acd4d",
  },
} satisfies Record<string, SourceReference>;

export const companySources = {
  ashby: {
    title: "Why Ashby — Answer Card",
    url: "https://app.notion.com/p/3e0e60f718a9818c8daadc6396050d48",
  },
  attio: {
    title: "Why Attio — Answer Card",
    url: "https://app.notion.com/p/3e0e60f718a981d1956ef09f5649ccc2",
  },
  linear: {
    title: "Why Linear — Answer Card",
    url: "https://app.notion.com/p/3e0e60f718a98183b920c4fec6073866",
  },
} satisfies Record<CompanyId, SourceReference>;
