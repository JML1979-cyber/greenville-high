export const ENTRY_PATH_SOURCE = "entry-assessment-v1";
export const ENTRY_PATHS = Object.freeze(["support", "extended"]);

const clone = (value) => structuredClone(value);
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export const validateEntryPathAssignment = (assignment, expectedAnswerCount = 10) => {
  if (assignment === null) return null;
  if (!isObject(assignment) || !ENTRY_PATHS.includes(assignment.path)) {
    throw new Error("Die interne Wegzuweisung besitzt einen ungültigen Pfad.");
  }
  if (!Number.isInteger(assignment.correctCount)
    || assignment.correctCount < 0
    || assignment.correctCount > expectedAnswerCount) {
    throw new Error("Die Zahl richtiger Eingangsantworten ist ungültig.");
  }
  const expectedPath = assignment.correctCount <= 5 ? "support" : "extended";
  if (assignment.path !== expectedPath) {
    throw new Error("Pfad und Zahl richtiger Eingangsantworten sind widersprüchlich.");
  }
  if (assignment.source !== ENTRY_PATH_SOURCE
    || typeof assignment.assignedAt !== "string"
    || Number.isNaN(Date.parse(assignment.assignedAt))) {
    throw new Error("Quelle oder Zeitpunkt der internen Wegzuweisung sind ungültig.");
  }
  return clone(assignment);
};

/**
 * Pure domain service for the provisional two-path assignment. It deliberately
 * ignores competence profiles, reviews and RoutingEngine recommendations.
 */
export class EntryPathAssigner {
  constructor(taskIds, { clock = () => new Date().toISOString() } = {}) {
    if (!Array.isArray(taskIds) || taskIds.length !== 10 || new Set(taskIds).size !== taskIds.length) {
      throw new Error("Die Wegzuweisung benötigt genau zehn eindeutige Eingangsaufgaben.");
    }
    this.taskIds = [...taskIds];
    this.taskIdSet = new Set(taskIds);
    this.clock = clock;
  }

  validateAnswers(answers) {
    if (!Array.isArray(answers)) throw new Error("Eingangsantworten müssen als Liste vorliegen.");
    const seen = new Set();
    for (const answer of answers) {
      if (!isObject(answer) || !this.taskIdSet.has(answer.fragenId) || seen.has(answer.fragenId)) {
        throw new Error("Die Eingangsantworten enthalten unbekannte oder doppelte Aufgabenreferenzen.");
      }
      if (![true, false, null].includes(answer.richtig)) {
        throw new Error("Eine Eingangsantwort besitzt keinen gültigen automatischen Bewertungsstatus.");
      }
      seen.add(answer.fragenId);
    }
    return answers;
  }

  hasCompleteAutomaticAssessment(answers) {
    try {
      this.validateAnswers(answers);
      return answers.length === this.taskIds.length
        && answers.every((answer) => typeof answer.richtig === "boolean");
    } catch {
      return false;
    }
  }

  assign(answers, existingAssignment = null) {
    if (existingAssignment !== null) return validateEntryPathAssignment(existingAssignment, this.taskIds.length);
    this.validateAnswers(answers);
    const correctCount = answers.filter((answer) => answer.richtig === true).length;
    return Object.freeze({
      path: correctCount <= 5 ? "support" : "extended",
      correctCount,
      assignedAt: this.clock(),
      source: ENTRY_PATH_SOURCE
    });
  }
}
