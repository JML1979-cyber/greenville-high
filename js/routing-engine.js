const clone = (value) => structuredClone(value);

const uniqueTasks = (evidences) => new Set(evidences.map((evidence) => evidence.aufgabenId)).size;
const detectedMisconceptions = (evidence) => evidence.aktiveSichtung?.festgestellte_fehlvorstellungen ?? [];

/** Creates transparent, qualitative support recommendations from reviewed evidence. */
export class RoutingEngine {
  recommend(reviewedEvaluation) {
    if (!reviewedEvaluation?.evidenzen) throw new TypeError("Eine gesichtete Auswertung wird benötigt.");

    const themeMap = new Map();
    reviewedEvaluation.evidenzen.forEach((evidence) => {
      if (!themeMap.has(evidence.thema)) themeMap.set(evidence.thema, []);
      themeMap.get(evidence.thema).push(evidence);
    });

    const themen = Array.from(themeMap, ([thema, evidences]) => ({
      thema,
      ...this.decide(evidences)
    }));
    const gesamt = this.decide(reviewedEvaluation.evidenzen);
    const distinctThemeRecommendations = new Set(themen.map((entry) => entry.empfehlung));
    if (distinctThemeRecommendations.size > 1 || themen.some((entry) => entry.empfehlung !== gesamt.empfehlung)) {
      gesamt.hinweis = "Die Themen führen zu unterschiedlichen Empfehlungen; die Gesamtsicht ersetzt die Themenentscheidungen nicht.";
    }

    return clone({
      themen,
      gesamt,
      hinweis: "Förderempfehlungen sind qualitative, nicht automatisch navigierende Hinweise ohne Punkte, Prozentwerte oder Schwierigkeitsgewichtung."
    });
  }

  decide(evidences) {
    const positive = evidences.filter((entry) => entry.wirksamerStatus === "nachgewiesen");
    const partial = evidences.filter((entry) => entry.wirksamerStatus === "teilweise nachgewiesen");
    const negative = evidences.filter((entry) => entry.wirksamerStatus === "nicht nachgewiesen");
    const open = evidences.filter((entry) => entry.wirksamerStatus === "offen");
    const misconceptionEvidence = evidences.filter((entry) => detectedMisconceptions(entry).length > 0);
    const used = [...new Map([...positive, ...partial, ...negative, ...misconceptionEvidence]
      .map((entry) => [entry.aufgabenId, entry])).values()];

    if (positive.length && (negative.length || misconceptionEvidence.length)) {
      return this.result("training", "widersprüchliche-evidenz", "Positive und negative beziehungsweise als Fehlvorstellung dokumentierte Evidenzen widersprechen einander.", used, open);
    }
    if (partial.length && (positive.length || negative.length || misconceptionEvidence.length)) {
      return this.result("training", "gemischte-evidenz", "Teilweise nachgewiesene und weitere auswertbare Evidenzen erfordern gezieltes Training.", used, open);
    }
    if (misconceptionEvidence.length) {
      return this.result("repair", "festgestellte-fehlvorstellung", "Eine Lehrkraft hat mindestens eine Fehlvorstellung ausdrücklich dokumentiert.", misconceptionEvidence, open);
    }
    if (negative.length) {
      return this.result("repair", "eindeutig-negative-evidenz", "Mindestens eine eindeutige negative Evidenz liegt ohne widersprechende positive Evidenz vor.", negative, open);
    }
    if (partial.length >= 2 && uniqueTasks(partial) >= 2) {
      return this.result("training", "teilweise-evidenz", "Mehrere Aufgaben zeigen teilweise nachgewiesene Kompetenz und begründen weiteres Training.", partial, open);
    }
    if (positive.length >= 2 && uniqueTasks(positive) >= 2) {
      return this.result("research", "konsistent-positive-evidenz", "Mehrere unterschiedliche Aufgaben zeigen konsistent nachgewiesene Kompetenz.", positive, open);
    }
    return this.result("unentschieden", "unzureichende-evidenz", "Es liegen noch nicht genügend auswertbare, konsistente Evidenzen für eine Förderzuweisung vor.", used, open);
  }

  result(empfehlung, regel, begründung, evidenzen, offeneEvidenzen) {
    return {
      empfehlung,
      regel,
      begründung,
      evidenzen: clone(evidenzen),
      offeneEvidenzen: clone(offeneEvidenzen)
    };
  }
}
