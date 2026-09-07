import { DiagnosticEngine } from "./diagnostic-engine.js";

const PATHS = ["support", "extended"];

/** Volatile chemistry content session; persistence and map state remain unchanged. */
export class ChemistryLabSession {
  constructor(packages) {
    this.packages = {};
    for (const path of PATHS) {
      const tasks = packages?.[path];
      if (!Array.isArray(tasks) || tasks.length !== 4) throw new Error(`Das Chemielabor benötigt für ${path} genau vier Aufgaben.`);
      tasks.forEach((task, index) => {
        if (task.path !== path || task.reihenfolge !== index + 1) throw new Error(`Ungültige Chemielabor-Aufgabe: ${task.id}`);
      });
      new DiagnosticEngine(tasks);
      this.packages[path] = structuredClone(tasks);
    }
    this.session = new DiagnosticEngine([]);
    this.path = null;
  }

  activate(path) {
    if (!PATHS.includes(path)) return false;
    if (this.path === path) return true;
    this.path = path;
    this.session.loadTasks(this.packages[path]);
    return true;
  }

  getCurrentTask() { return this.session.getCurrentTask(); }
  recordAnswer(taskId, answer) { return this.session.recordAnswer(taskId, answer); }
  nextTask() { return this.session.nextTask(); }
  reset() { this.path = null; this.session.loadTasks([]); }
}
