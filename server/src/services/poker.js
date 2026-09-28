/*
 * Planning poker rounds, one per project, kept in memory (a round lasts a few
 * minutes and only matters to the people in the room). Votes stay hidden
 * until someone reveals them; the chosen estimate is then saved on the task
 * through the normal REST API.
 */
export const CARDS = ['0', '1', '2', '3', '5', '8', '13', '21', '?', 'coffee'];

// projectId -> { taskId, startedBy, revealed, votes: Map(userId -> { value, user }) }
const rounds = new Map();

export function startRound(projectId, taskId, user) {
  const round = { taskId: String(taskId), startedBy: user._id, revealed: false, votes: new Map() };
  rounds.set(String(projectId), round);
  return round;
}

export const getRound = (projectId) => rounds.get(String(projectId)) ?? null;

export function vote(projectId, user, value) {
  const round = getRound(projectId);
  if (!round || round.revealed || !CARDS.includes(value)) return null;
  // Clicking the same card again takes the vote back
  if (round.votes.get(user._id)?.value === value) round.votes.delete(user._id);
  else round.votes.set(user._id, { value, user });
  return round;
}

export function reveal(projectId) {
  const round = getRound(projectId);
  if (!round || round.votes.size === 0) return null;
  round.revealed = true;
  return round;
}

/** Same task, new vote (after a discussion). */
export function restart(projectId) {
  const round = getRound(projectId);
  if (!round) return null;
  round.revealed = false;
  round.votes.clear();
  return round;
}

export const endRound = (projectId) => rounds.delete(String(projectId));

/** Average of the numeric votes and the closest card, for the "save" suggestion. */
export function summary(values) {
  const numbers = values.filter((v) => /^\d+$/.test(v)).map(Number);
  if (!numbers.length) return { average: null, suggestion: null, consensus: false };
  const average = Math.round((numbers.reduce((a, b) => a + b, 0) / numbers.length) * 10) / 10;
  const numericCards = CARDS.filter((c) => /^\d+$/.test(c)).map(Number);
  // Ties go to the bigger card: estimates are usually optimistic
  const suggestion = numericCards.reduce((best, c) => (Math.abs(c - average) <= Math.abs(best - average) ? c : best), numericCards[0]);
  return { average, suggestion, consensus: values.length > 1 && values.every((v) => v === values[0]) };
}

/** What clients see: who voted, and the values only once revealed. */
export function publicState(projectId) {
  const round = getRound(projectId);
  if (!round) return null;
  const votes = [...round.votes.values()].map(({ value, user }) => ({ user, value: round.revealed ? value : null }));
  return {
    taskId: round.taskId,
    startedBy: round.startedBy,
    revealed: round.revealed,
    votes,
    ...(round.revealed && summary(votes.map((v) => v.value))),
  };
}
