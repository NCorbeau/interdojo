# Phase 1 dogfood report

Date: 2026-09-22

## Verdict

Phase 1's usable-outcome criterion is met. Interdojo supports a complete, useful practice loop: choose a mode, answer mixed drills, receive immediate source-linked feedback, finish a session, review strengths and gaps, and retain the result. No P0 blocker was found.

The dogfood pass found one P1 copy mismatch and one P2 hint issue. Both were corrected during integration before the final Phase 1 build.

## Coverage

- Completed a 7-drill Daily Sprint containing all four interaction types: choice, multi-select, ordering, and anchor reconstruction.
- Completed a 7-drill Engineering session and reached the result summary.
- Completed an Interview session and reached the result summary.
- Verified correct and incorrect answer feedback, explanations, canonical Notion links, progress, strong/review groupings, retry, exit, and return-home flows.
- Verified number-key selection and Enter-to-check/advance. Native buttons also work with keyboard activation and expose visible focus/pressed states.
- Verified browser persistence after returning home and reloading. The latest 7-attempt session reappeared after client hydration.
- Verified the local API fallback: `GET /api/sessions` returns `{ "sessions": [], "storage": "local" }`; a valid `POST` returns HTTP 202 with `{ "stored": false, "storage": "local" }` while the browser copy remains usable.
- Queried the configured remote D1 database read-only; the `sessions` table was available in EEUR and contained two saved sessions.
- Checked representative viewports: iPhone 390×844, iPad 820×1180, and MacBook 1440×900. No horizontal overflow occurred. Exercise controls remained at least 44 px high on phone, and results/actions remained usable with ordinary vertical scrolling.

## Findings

### Resolved P1 — Interview advertised six drills but ran seven

Reproduction:

1. Open the home screen.
2. Observe the Interview card: `6 drills · 7 min`.
3. Start Interview.
4. Observe the session header: `1 / 7`.
5. Complete the session; the result summary reports seven attempts.

Cause: the mode copy says six drills in `src/app/components/arcade-app.tsx:51`, while every non-daily mode is sliced to seven exercises in `src/lib/session.ts:30-32`.

Resolution: the Interview card now advertises `7 drills · 7 min`, matching the session builder and result summary.

### Resolved P2 — Anchor exercises showed an ordering-specific shortcut hint

Reproduction:

1. Open an anchor-reconstruction exercise.
2. Read the footer hint: `Arrow controls reorder · Enter checks`.
3. The exercise is built by adding/removing anchor chips; there are no arrow controls.

Cause: `src/app/components/arcade-app.tsx:479-482` groups ordering and anchor reconstruction under the same fallback hint.

Resolution: anchor reconstruction now shows `Select anchors in speaking order · Enter checks`, while ordering retains its arrow-control hint.

## What worked well

- The loop is fast and self-explanatory; feedback appears immediately and links back to the preparation source.
- The expanded exercise bank provides enough variety that repeated sessions do not feel identical.
- Correct-answer and selected-answer states are distinguishable, including accessible labels.
- Keyboard focus moves to each new question, number shortcuts work for choice controls, and Enter supports a fast desktop cadence.
- Phone and tablet layouts preserve readable cards, generous touch targets, and clear primary actions without horizontal scrolling.
- Local-first persistence keeps development/offline behavior useful, while the same API is wired to D1 for deployed cross-device history.

## Blockers

None.
