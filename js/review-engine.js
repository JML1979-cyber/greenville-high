import { groupQualitativeEvidence } from "./evaluation-engine.js";

const VALID_REVIEW_STATUSES = new Set([
  "nachgewiesen",
  "teilweise nachgewiesen",
  "nicht nachgewiesen",
  "offen"
]);

const clone = (value) => structuredClone(value);

/** Maintains append-only teacher reviews without changing raw or automatic evidence. */
export class ReviewEngine {
  constructor({ clock = () => new Date().toISOString() } = {}) {
    this.clock = clock;
  }

  createReview(evaluation, previousReviews, input) {
    if (!evaluation?.evidenzen || !Array.isArray(previousReviews)) {
      throw new TypeError("Auswertung und bisheriger Sichtungsverlauf werden benötigt.");
    }
    const evidence = evaluation.evidenzen.find((entry) => entry.aufgabenId === input.aufgabenId);
    if (!evidence) throw new Error(`Keine Evidenz für Aufgabe ${input.aufgabenId} gefunden.`);
    if (evidence.antworttyp !== "freitext" || evidence.status !== "offen") {
      throw new Error("Manuelle Sichtungen sind nur für automatisch offene Freitextantworten vorgesehen.");
    }
    if (!VALID_REVIEW_STATUSES.has(input.status)) {
      throw new Error(`Ungültiger Sichtungsstatus: ${input.status}`);
    }
    if (input.quelle !== "lehrkraft") {
      throw new Error("In Version 0.5 ist ausschließlich die Quelle lehrkraft zulässig.");
    }

    const misconceptions = input.festgestellte_fehlvorstellungen ?? [];
    if (!Array.isArray(misconceptions)) {
      throw new TypeError("Festgestellte Fehlvorstellungen müssen als Array vorliegen.");
    }
    const possibleIds = new Set((evidence.mögliche_fehlvorstellungen ?? []).map((item) => item.id));
    misconceptions.forEach((id) => {
      if (!possibleIds.has(id)) throw new Error(`Unbekannte Fehlvorstellung für ${input.aufgabenId}: ${id}`);
    });

    const zeitstempel = this.clock();
    return clone({
      sichtungsId: `${input.aufgabenId}-${zeitstempel}-${previousReviews.length + 1}`,
      aufgabenId: input.aufgabenId,
      status: input.status,
      kommentar: String(input.kommentar ?? ""),
      quelle: "lehrkraft",
      zeitstempel,
      ...(misconceptions.length ? { festgestellte_fehlvorstellungen: [...misconceptions] } : {})
    });
  }

  applyReviews(evaluation, reviews) {
    if (!evaluation?.evidenzen || !Array.isArray(reviews)) {
      throw new TypeError("Auswertung und Sichtungsverlauf werden benötigt.");
    }

    const ordered = reviews.map((review, index) => ({ review, index })).sort((left, right) => {
      const byTime = Date.parse(left.review.zeitstempel) - Date.parse(right.review.zeitstempel);
      return byTime || left.index - right.index;
    });
    const latestByTask = new Map();
    ordered.forEach(({ review }) => latestByTask.set(review.aufgabenId, review));

    const evidences = evaluation.evidenzen.map((evidence) => {
      const history = reviews.filter((review) => review.aufgabenId === evidence.aufgabenId);
      const active = latestByTask.get(evidence.aufgabenId) ?? null;
      return {
        ...clone(evidence),
        automatischerStatus: evidence.status,
        wirksamerStatus: active?.status ?? evidence.status,
        aktiveSichtung: clone(active),
        sichtungsverlauf: clone(history)
      };
    });

    return clone({
      ...evaluation,
      statusmodell: {
        ...evaluation.statusmodell,
        "teilweise nachgewiesen": "Die fachliche Sichtung dokumentiert eine teilweise tragfähige Kompetenzäußerung."
      },
      themen: groupQualitativeEvidence(evidences, (evidence) => [evidence.thema], { statusField: "wirksamerStatus" }),
      kompetenzen: groupQualitativeEvidence(evidences, (evidence) => evidence.kompetenztags, { statusField: "wirksamerStatus" }),
      evidenzen: evidences,
      sichtungsverlauf: clone(reviews)
    });
  }
}
