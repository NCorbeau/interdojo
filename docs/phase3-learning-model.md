# Phase 3 learning evidence contract

Interdojo records evidence, not a global mastery score. An exercise's `evidenceLevel`
is the strongest kind of evidence its interaction can provide:

| Level | What the learner does | What a success means |
| --- | --- | --- |
| Recognize | Select an answer from supplied options | Correct recognition in this context |
| Recall | Produce an answer before seeing model points | Self-reported recall, not machine-graded |
| Apply | Order or assemble supplied steps/anchors | Correct constrained application |
| Explain | Explain before seeing model points | Self-reported explanation, not machine-graded |

Choice and multi-select never claim unaided recall or explanation. Existing ordering
and anchor exercises are constrained application, not spoken explanation. A
`difficulty` of 1–3 is separate from evidence level: a hard recognition question
does not become an explanation test.

Graded attempts have `correct: true | false`. Say-first self-checks have
`correct: null` and `selfAssessment: "got-it" | "needs-work"`. Only graded
attempts enter objective accuracy; a self-rating can influence what to practice
next but never establishes graded correctness. Attempt metadata stores the
exercise's evidence ceiling and difficulty at the time of play. Legacy attempts
without metadata remain valid; choices conservatively count as Recognize and
ordering/anchor exercises as Apply.

The learning state is recomputed from the existing session history. Recent
graded misses, self-reported needs-work, and practice older than five days
increase priority. Repeated success suggests a higher evidence level, but the
state calls this a *recommendation*, not mastery. Daily Sprint reserves at most
one focused slot per track for a recent miss or stale skill, weights the rest,
keeps its 4 Engineering + 3 Interview split, limits self-checks, and penalizes
exact repeats. Company Worlds keep their quotas, company-motivation guarantee,
and company-specific eligibility; adaptation is a smaller weighting nudge.
Rapid Fire retains its graded recent-miss behavior.

No separate mastery table, AI grading, audio recording, or runtime Notion sync is
part of Phase 3. The canonical technical content and readiness priorities live
in Notion; the app is a practice surface.
