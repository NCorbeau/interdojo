/** Keep a run's choice positions stable across renders and restored sessions. */
export function orderBossFightChoices<T extends { id: string }>(
  choices: readonly T[],
  runId: string,
  stageId: string,
): T[] {
  const ordered = [...choices];
  let seed = 2166136261;
  for (const char of `${runId}\u0000${stageId}`) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }

  // A seeded Fisher-Yates shuffle avoids changing order during a React rerender.
  for (let index = ordered.length - 1; index > 0; index--) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const swapIndex = (seed >>> 0) % (index + 1);
    [ordered[index], ordered[swapIndex]] = [ordered[swapIndex], ordered[index]];
  }
  return ordered;
}
