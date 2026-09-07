import { validateEntryPathAssignment } from "./entry-path-assigner.js";

/**
 * Central, domain-only state container. It deliberately has no UI knowledge,
 * so future missions and subjects can reuse it unchanged.
 */
export class Engine {
  constructor(player = {}) {
    this.initialPlayer = player;
    this.listeners = new Set();
    this.reset();
  }

  reset() {
    this.state = {
      currentRoom: null,
      currentScreen: "start",
      points: 0,
      tags: [],
      answers: [],
      competencies: {},
      evaluation: null,
      reviews: [],
      reviewedEvaluation: null,
      recommendations: null,
      entryPathAssignment: null,
      followUpEvaluation: null,
      gamePath: [],
      player: { ...this.initialPlayer }
    };
    this.notify();
  }

  getState() {
    // Consumers receive a snapshot and cannot mutate the engine accidentally.
    return structuredClone(this.state);
  }

  getEntryPathAssignment() {
    return structuredClone(this.state.entryPathAssignment);
  }

  prepareStateRestore(state) {
    if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error("Ungültiger zentraler Spielstatus.");
    const requiredArrays = ["answers", "reviews", "gamePath", "tags"];
    if (!state.player || requiredArrays.some((field) => !Array.isArray(state[field]))) {
      throw new Error("Der zentrale Spielstatus ist unvollständig.");
    }
    const prepared = structuredClone(state);
    prepared.entryPathAssignment ??= null;
    prepared.entryPathAssignment = validateEntryPathAssignment(prepared.entryPathAssignment);
    prepared.followUpEvaluation ??= null;
    if (prepared.followUpEvaluation !== null
      && (typeof prepared.followUpEvaluation !== "object" || Array.isArray(prepared.followUpEvaluation))) {
      throw new Error("Die Auswertung der Folgeaufgaben ist ungültig.");
    }
    return prepared;
  }

  commitStateRestore(preparedState) {
    this.state = structuredClone(preparedState);
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setScreen(screen) {
    this.state.currentScreen = screen;
    if (this.state.gamePath.at(-1) !== screen) this.state.gamePath.push(screen);
    this.notify();
  }

  enterRoom(roomId) {
    this.state.currentRoom = roomId;
    this.notify();
  }

  recordAnswer(questionId, answer) {
    const index = this.state.answers.findIndex((entry) => entry.questionId === questionId);
    const entry = { questionId, answer, timestamp: new Date().toISOString() };
    if (index >= 0) this.state.answers[index] = entry;
    else this.state.answers.push(entry);
    this.notify();
  }

  /** Receives local diagnostic snapshots without coupling this engine to task rules. */
  setDiagnosticState({ answers, profile }) {
    this.state.answers = structuredClone(answers);
    this.state.competencies = structuredClone(profile);
    this.notify();
  }

  setEvaluationResult(evaluation) {
    this.state.evaluation = structuredClone(evaluation);
    this.notify();
  }

  /** Appends a review; existing review records are never replaced or removed. */
  addManualReview(review) {
    this.state.reviews.push(structuredClone(review));
    this.notify();
  }

  setReviewedEvaluation(evaluation) {
    this.state.reviewedEvaluation = structuredClone(evaluation);
    this.notify();
  }

  setRecommendations(recommendations) {
    this.state.recommendations = structuredClone(recommendations);
    this.notify();
  }

  /** Stores the provisional entry path once without exposing it to renderers. */
  setEntryPathAssignment(assignment) {
    if (this.state.entryPathAssignment !== null) return structuredClone(this.state.entryPathAssignment);
    this.state.entryPathAssignment = validateEntryPathAssignment(assignment);
    this.notify();
    return structuredClone(this.state.entryPathAssignment);
  }

  setFollowUpEvaluation(evaluation) {
    this.state.followUpEvaluation = structuredClone(evaluation);
    this.notify();
  }

  addTag(tag) {
    if (!this.state.tags.includes(tag)) this.state.tags.push(tag);
    this.notify();
  }

  notify() {
    this.listeners.forEach((listener) => listener(this.getState()));
  }
}
