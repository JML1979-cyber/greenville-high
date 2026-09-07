const VALID_DIFFICULTY_LEVELS = new Set([1, 2, 3]);

const clone = (value) => structuredClone(value);

const createGroup = (name) => ({
  name,
  status: "offen",
  hinweis: "Fachliche Sichtung erforderlich.",
  evidenzen: []
});

export const groupQualitativeEvidence = (
  evidences,
  selectKeys,
  { statusField = "status", minimumEvidence = 1 } = {}
) => {
  const groups = new Map();
  evidences.forEach((evidence) => {
    selectKeys(evidence).forEach((key) => {
      if (!groups.has(key)) groups.set(key, createGroup(key));
      groups.get(key).evidenzen.push(clone(evidence));
    });
  });

  return Array.from(groups.values()).map((group) => {
    const resolved = group.evidenzen.filter((evidence) => evidence[statusField] !== "offen");
    if (resolved.length < minimumEvidence) return group;

    const statuses = new Set(resolved.map((evidence) => evidence[statusField]));
    if (statuses.size !== 1) {
      group.hinweis = "Widersprüchliche Evidenz; fachliche Sichtung erforderlich.";
      return group;
    }

    group.status = resolved[0][statusField];
    group.hinweis = "Aus ausreichend vorhandener, konsistenter Evidenz abgeleitet.";
    return group;
  });
};

/**
 * Produces a qualitative competence profile from completed task answers.
 * Difficulty levels are retained as evidence metadata and are not weighted.
 */
export class EvaluationEngine {
  constructor({ minimumAutomaticEvidence = 1 } = {}) {
    if (!Number.isInteger(minimumAutomaticEvidence) || minimumAutomaticEvidence < 1) {
      throw new TypeError("Die Mindestzahl automatischer Evidenzen muss eine positive ganze Zahl sein.");
    }
    this.minimumAutomaticEvidence = minimumAutomaticEvidence;
  }

  evaluate(tasks, answers) {
    if (!Array.isArray(tasks) || !Array.isArray(answers)) {
      throw new TypeError("Aufgaben und Antworten müssen als Arrays vorliegen.");
    }

    const taskById = new Map(tasks.map((task) => {
      if (!VALID_DIFFICULTY_LEVELS.has(task.schwierigkeitsgrad)) {
        throw new Error(`Aufgabe ${task.id} benötigt einen Schwierigkeitsgrad der Stufe 1, 2 oder 3.`);
      }
      return [task.id, task];
    }));

    const evidences = answers.map((answer) => this.createEvidence(taskById.get(answer.fragenId), answer));
    const themen = this.groupEvidence(evidences, (evidence) => [evidence.thema]);
    const kompetenzen = this.groupEvidence(evidences, (evidence) => evidence.kompetenztags);

    return clone({
      statusmodell: {
        nachgewiesen: "Alle ausreichend vorhandenen, automatisch auswertbaren Evidenzen sind richtig.",
        "nicht nachgewiesen": "Alle ausreichend vorhandenen, automatisch auswertbaren Evidenzen sind eindeutig falsch.",
        offen: "Es fehlen ausreichend automatisch auswertbare Evidenzen, die Evidenz ist widersprüchlich oder eine fachliche Sichtung ist erforderlich."
      },
      mindestanzahlAutomatischerEvidenzen: this.minimumAutomaticEvidence,
      hinweisSchwierigkeitsgrad: "Stufe 1 bis 3; in Version 0.4 dokumentiert, aber nicht gewichtet.",
      themen,
      kompetenzen,
      evidenzen: evidences,
      rohantworten: answers
    });
  }

  createEvidence(task, answer) {
    if (!task) throw new Error(`Keine Aufgabe zur Antwort ${answer.fragenId} gefunden.`);

    const status = answer.richtig === true
      ? "nachgewiesen"
      : answer.richtig === false
        ? "nicht nachgewiesen"
        : "offen";

    return {
      aufgabenId: task.id,
      titel: task.titel,
      thema: task.thema,
      kompetenztags: [...task.kompetenztags],
      diagnosetags: [...task.diagnosetags],
      mögliche_fehlvorstellungen: clone(task.fehlvorstellungen),
      kc_referenz: clone(task.kc_referenz),
      schwierigkeitsgrad: task.schwierigkeitsgrad,
      antworttyp: task.antworttyp,
      status,
      hinweis: status === "offen" ? "Fachliche Sichtung erforderlich." : "Automatisch eindeutig ausgewertet.",
      rohantwort: clone(answer)
    };
  }

  groupEvidence(evidences, selectKeys) {
    return groupQualitativeEvidence(evidences, selectKeys, {
      minimumEvidence: this.minimumAutomaticEvidence
    });
  }
}
