import { DiagnosticEngine } from "./diagnostic-engine.js";
import { validateEntryPathAssignment } from "./entry-path-assigner.js";

const PATHS = ["support", "extended"];
const clone = (value) => structuredClone(value);

/** Owns one selected seven-task session while keeping both packages out of the UI. */
export class FollowUpEngine {
  constructor(packages) {
    if (!packages || typeof packages !== "object") throw new Error("Folgeaufgabenpakete fehlen.");
    this.packages = {};
    const allIds = [];
    for (const path of PATHS) {
      const tasks = packages[path];
      if (!Array.isArray(tasks) || tasks.length !== 7) throw new Error(`Der Aufgabenweg ${path} benötigt genau sieben Aufgaben.`);
      tasks.forEach((task, index) => {
        if (task.path !== path || task.reihenfolge !== index + 1) {
          throw new Error(`Aufgabe ${task.id} besitzt einen ungültigen Weg oder eine ungültige Reihenfolge.`);
        }
      });
      new DiagnosticEngine(tasks);
      this.packages[path] = clone(tasks);
      allIds.push(...tasks.map((task) => task.id));
    }
    if (new Set(allIds).size !== allIds.length) throw new Error("Folgeaufgaben benötigen global eindeutige IDs.");
    this.session = new DiagnosticEngine([]);
    this.path = null;
  }

  activate(assignment) {
    const validated = validateEntryPathAssignment(assignment);
    if (!validated) throw new Error("Die Folgeaufgaben benötigen eine interne Eingangszuweisung.");
    if (this.path === validated.path) return this.getSnapshot();
    this.path = validated.path;
    this.session.loadTasks(this.packages[this.path]);
    return this.getSnapshot();
  }

  getCurrentTask() { return this.session.getCurrentTask(); }
  getActiveTasks() { return this.path ? clone(this.packages[this.path]) : []; }

  recordAnswer(taskId, answer) {
    if (!this.path) throw new Error("Es ist kein Folgeaufgabenweg aktiv.");
    return this.session.recordAnswer(taskId, answer);
  }

  nextTask() { return this.session.nextTask(); }

  reset() {
    this.path = null;
    this.session.loadTasks([]);
  }

  exportState() {
    return { path: this.path, ...this.session.exportState() };
  }

  prepareStateRestore(state, assignment) {
    const validatedAssignment = validateEntryPathAssignment(assignment);
    if (!validatedAssignment) throw new Error("Ein Folgeaufgabenstand benötigt eine Eingangszuweisung.");
    const candidate = state ?? { path: validatedAssignment.path, currentIndex: 0, answers: [], profile: {} };
    if (candidate.path !== validatedAssignment.path) throw new Error("Folgeaufgabenweg und Eingangszuweisung widersprechen sich.");
    const session = new DiagnosticEngine(this.packages[candidate.path]);
    const preparedSession = session.prepareStateRestore(candidate);
    return { path: candidate.path, ...preparedSession };
  }

  commitStateRestore(preparedState) {
    this.path = preparedState.path;
    this.session.loadTasks(this.packages[this.path]);
    this.session.commitStateRestore(preparedState);
  }

  getSnapshot() {
    return { path: this.path, ...this.session.getSnapshot(), currentIndex: this.session.currentIndex };
  }
}
