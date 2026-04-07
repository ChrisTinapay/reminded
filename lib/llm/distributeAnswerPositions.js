/**
 * Ensures the correct answer cycles evenly across positions (A, B, C, D).
 * Same logic as course page — keep in sync if you change distribution rules.
 */
export function distributeAnswerPositions(questions) {
  return questions.map((q, idx) => {
    const choices = [...q.choices];
    const correctIdx = choices.indexOf(q.correct_answer);
    if (correctIdx === -1) return q;

    const targetPos = idx % choices.length;
    if (correctIdx !== targetPos) {
      [choices[correctIdx], choices[targetPos]] = [choices[targetPos], choices[correctIdx]];
    }
    return { ...q, choices };
  });
}
