import { getAnswerTypeStrategy } from "./answer-types.js";

/**
 * Required metadata for every future task object. The fields keep the
 * diagnostic layer independent from a concrete subject, room or UI widget.
 */
export const REQUIRED_TASK_FIELDS = [
  "id", "titel", "story", "thema", "aufgabe", "antworttyp", "lösung",
  "kompetenztags", "fehlvorstellungen", "lernziel", "kc_referenz", "diagnosetags",
  "förderhinweise", "antwortmöglichkeiten", "schwierigkeitsgrad"
];

/**
 * Internal profile for documented competence signals. It is not a grade,
 * score or judgement of a learner and is never persisted by this component.
 */
export const createCompetencyProfile = () => ({
  mechanik: 0,
  elektrizität: 0,
  energie: 0,
  optik: 0,
  teilchenmodell: 0,
  stoffeigenschaften: 0,
  prozesskompetenzen: { EG: 0, K: 0, B: 0 }
});

/**
 * Local task and diagnostic-data coordinator.
 *
 * DiagnosticEngine accepts only JSON task objects, preserves their order and
 * records a standard answer model. Evaluation rules and area selection remain
 * deliberately incomplete: the component exposes a neutral placeholder for
 * the later Reparatur-/Forschungsentscheidung instead of judging a person.
 */
export class DiagnosticEngine {
  constructor(tasks = []) {
    this.listeners = new Set();
    this.tasks = [];
    this.currentIndex = 0;
    this.answers = [];
    this.profile = createCompetencyProfile();
    this.loadTasks(tasks);
  }

  /** Validates and loads task objects while retaining their JSON order. */
  loadTasks(tasks) {
    if (!Array.isArray(tasks)) throw new TypeError("Aufgaben müssen als JSON-Array vorliegen.");
    tasks.forEach((task) => this.validateTask(task));
    this.tasks = structuredClone(tasks);
    this.currentIndex = 0;
    this.notify();
  }

  validateTask(task) {
    const missing = REQUIRED_TASK_FIELDS.filter((field) => !(field in task));
    if (missing.length) throw new Error(`Aufgabenobjekt unvollständig: ${missing.join(", ")}`);
    const strategy = getAnswerTypeStrategy(task.antworttyp);
    if (!strategy) throw new Error(`Nicht unterstützter Antworttyp: ${task.antworttyp}`);
    if (![1, 2, 3].includes(task.schwierigkeitsgrad)) {
      throw new Error(`Aufgabe ${task.id} benötigt einen Schwierigkeitsgrad der Stufe 1, 2 oder 3.`);
    }
    strategy.validateTask?.(task);
  }

  getCurrentTask() {
    return structuredClone(this.tasks[this.currentIndex] ?? null);
  }

  reset() {
    this.currentIndex = 0;
    this.answers = [];
    this.profile = createCompetencyProfile();
    this.notify();
  }

  exportState() {
    return structuredClone({
      currentIndex: this.currentIndex,
      answers: this.answers,
      profile: this.profile
    });
  }

  prepareStateRestore(state) {
    if (!state || !Number.isInteger(state.currentIndex) || state.currentIndex < 0 || state.currentIndex > this.tasks.length) {
      throw new Error("Ungültiger Diagnosezustand.");
    }
    if (!Array.isArray(state.answers) || !state.profile || typeof state.profile !== "object") {
      throw new Error("Antworten oder Diagnoseprofil sind ungültig.");
    }
    const knownIds = new Set(this.tasks.map((task) => task.id));
    if (state.answers.some((answer) => !knownIds.has(answer?.fragenId))) {
      throw new Error("Der Diagnosezustand referenziert eine unbekannte Aufgabe.");
    }
    for (const answer of state.answers) {
      const task = this.tasks.find((entry) => entry.id === answer.fragenId);
      const strategy = getAnswerTypeStrategy(task.antworttyp);
      if (strategy.evaluate(task, answer.antwort) !== answer.richtig) {
        throw new Error("Der Diagnosezustand enthält eine inkompatible Antwortfassung.");
      }
    }
    return structuredClone(state);
  }

  commitStateRestore(preparedState) {
    this.currentIndex = preparedState.currentIndex;
    this.answers = structuredClone(preparedState.answers);
    this.profile = structuredClone(preparedState.profile);
    this.notify();
  }

  nextTask() {
    this.currentIndex += 1;
    return this.getCurrentTask();
  }

  /**
   * Stores the normalized answer model. `richtig` remains null whenever a
   * placeholder task has no solution; this prevents accidental evaluation.
   */
  recordAnswer(taskId, answer) {
    const task = this.tasks.find((entry) => entry.id === taskId);
    if (!task) throw new Error(`Unbekannte Aufgaben-ID: ${taskId}`);

    const richtig = getAnswerTypeStrategy(task.antworttyp).evaluate(task, answer);
    const record = {
      fragenId: task.id,
      antwort: structuredClone(answer),
      richtig,
      zeit: new Date().toISOString(),
      kompetenztags: [...task.kompetenztags],
      basiskonzept: task.basiskonzept,
      prozesskompetenz: task.prozesskompetenz,
      anforderungsbereich: task.anforderungsbereich
    };
    this.answers.push(record);
    if (richtig === true) this.applyCompetenceTags(task);
    this.notify();
    return structuredClone(record);
  }

  /** Updates only known, internal profile keys; unknown future tags are safe. */
  applyCompetenceTags(task) {
    task.kompetenztags.forEach((tag) => {
      if (Object.hasOwn(this.profile, tag) && typeof this.profile[tag] === "number") {
        this.profile[tag] += 1;
      }
    });
    if (Object.hasOwn(this.profile.prozesskompetenzen, task.prozesskompetenz)) {
      this.profile.prozesskompetenzen[task.prozesskompetenz] += 1;
    }
  }

  /** Legacy compatibility hook; RoutingEngine does not consume this value. */
  getNextArea() {
    return { area: "ausstehend", reason: "Nicht verwendet; Förderempfehlungen erzeugt ausschließlich der RoutingEngine." };
  }

  getSnapshot() {
    return {
      currentTask: this.getCurrentTask(),
      answers: structuredClone(this.answers),
      profile: structuredClone(this.profile),
      nextArea: this.getNextArea()
    };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
