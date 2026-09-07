import { getAnswerTypeStrategy } from "./answer-types.js";

const escapeHtml = (value = "") => String(value).replace(/[&<>\"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
}[character]));

const frame = (eyebrow, title, content, actions = "") => `
  <section class="screen-panel">
    <p class="eyebrow">${escapeHtml(eyebrow)}</p>
    <h1>${escapeHtml(title)}</h1>
    <div class="screen-content">${content}</div>
    <div class="actions">${actions}</div>
  </section>`;

const storageErrorMessage = (error) => ({
  CORRUPT_DATA: "Die Datei ist beschädigt oder enthält keinen gültigen Spielstand.",
  INCOMPATIBLE_VERSION: "Der Spielstand stammt aus einer anderen Ausgabe.",
  INCOMPATIBLE_MISSION: "Der Spielstand gehört zu einer anderen Erkundung.",
  STORAGE_BLOCKED: "Der Browser blockiert den lokalen Speicher.",
  STORAGE_QUOTA: "Der lokale Speicher ist voll. Der Spielstand konnte nicht gespeichert werden.",
  INVALID_STRUCTURE: "Der Spielstand ist unvollständig oder beschädigt.",
  NO_SAVED_STATE: "Es ist kein gespeicherter Spielstand vorhanden.",
  RESTORE_FAILED: "Der Spielstand konnte nicht vollständig wiederhergestellt werden. Der bisherige Zustand bleibt erhalten."
}[error?.code] ?? "Die Speicheraktion konnte nicht ausgeführt werden.");

const showStorageFeedback = (root, message) => {
  const feedback = root.querySelector("#storage-feedback");
  if (feedback) feedback.textContent = message;
};

export const updateAnswerSubmitState = (form, button) => {
  if (!form || !button) return;
  if (typeof form.querySelectorAll !== "function") {
    button.disabled = !form.querySelector?.("input[name='answer']:checked");
    return;
  }
  const choices = form.querySelectorAll?.("input[type='radio'], input[type='checkbox']") ?? [];
  const selects = form.querySelectorAll?.("select") ?? [];
  const textInputs = form.querySelectorAll?.("input[type='number'], input[type='text'], textarea") ?? [];
  const choicesComplete = !choices.length || Boolean(form.querySelector?.("input[type='radio']:checked, input[type='checkbox']:checked"));
  const selectsComplete = Array.from(selects).every((select) => Boolean(select.value));
  const textComplete = Array.from(textInputs).every((input) => Boolean(input.value.trim()));
  button.disabled = !(choicesComplete && selectsComplete && textComplete);
};

export const nextFollowUpStoryScreen = (completedOrder, nextQuestion) => {
  if (completedOrder === 7) return "energy-cliffhanger";
  if (!nextQuestion) return "energy-cliffhanger";
  if (completedOrder === 3) return "mechanics-find";
  return "follow-up-questions";
};

const entrySequenceReactions = Object.freeze({
  4: [
    "Mr. Laser betrachtet die nächste Anzeige. „Komisch. An diese Aufgabe erinnere ich mich.“",
    "Er hält kurz inne. „Ich erinnere mich nur nicht daran, sie erstellt zu haben.“"
  ],
  8: [
    "Mr. Laser liest die nächste Anzeige zweimal. „Die gehören zu meinem Unterricht.“",
    "Kurze Pause. „Zumindest glaube ich das.“"
  ],
  10: [
    "Das Smartboard flackert für einen kurzen Moment. In einer Ecke steht M-02, dann ist die Kennzeichnung wieder verschwunden.",
    "Mr. Laser runzelt die Stirn. „Das hat es vorher nicht gemacht.“"
  ]
});

export const entrySequenceStory = (order) => (entrySequenceReactions[order] ?? [
  "Auf dem Smartboard erscheint die nächste Aufgabe."
]).map((paragraph) => `<p class="story">${escapeHtml(paragraph)}</p>`).join("");

export const completeEntryAssessment = ({
  answers, tasks, evaluation, review, routing, entryPathAssigner, engine, router, persistence
}) => {
  const result = evaluation.evaluate(tasks, answers);
  engine.setEvaluationResult(result);
  const reviewed = review.applyReviews(result, []);
  engine.setReviewedEvaluation(reviewed);
  engine.setRecommendations(routing.recommend(reviewed));
  const assignment = entryPathAssigner.assign(answers, engine.getState().entryPathAssignment);
  engine.setEntryPathAssignment(assignment);
  router.go("entry-transition");
  try { persistence.save(); } catch (error) { console.error(error); }
  return assignment;
};

const welcomeScreen = () => `
  <section class="screen-panel welcome-screen">
    <p class="eyebrow">Verbindung hergestellt</p>
    <h1>Greenville High School</h1>
    <div class="mr-laser-visual" role="img" aria-label="Stilisierte Darstellung des Physiklehrers Mr. Laser">
      <span class="laser-core"></span><span class="laser-beam"></span><span class="laser-orbit"></span>
    </div>
    <div class="mr-laser-dialog" aria-live="polite"></div>
    <div class="actions mr-laser-action" hidden>
      <button class="button button-primary" data-route="briefing">Mission beginnen</button>
    </div>
  </section>`;

const entryTransitionScreen = () => frame("Smartboard", "Die letzte Anzeige", `
    <p>Die letzte Aufgabe verschwindet. Der Bildschirm wird schwarz.</p>
    <p>Für einige Sekunden passiert nichts.</p>
    <p class="lead"><strong>SEQUENZ ABGESCHLOSSEN<br />M-02<br />ZIEL: LASERLABOR</strong></p>
    <p>Mr. Laser betrachtet die Anzeige. „Laserlabor?“</p>
    <p>Er schaut den Flur hinunter. „Das ist mein Raum.“</p>
    <p>Seine Hand wandert beinahe automatisch zu seinem großen Schlüsselbund.</p>
    <p>Nach einer kurzen Pause fügt er hinzu: „Zumindest … glaube ich das.“</p>`,
  `<button class="button button-primary" data-route="mechanics-transition">Zum Laserlabor</button>`);

const mechanicsTransitionScreen = () => frame("Laserlabor", "Der Schlüssel M-02", `
    <p>Im Laserlabor fällt Mr. Laser ein Schlüssel am großen Bund auf. Auf dem Anhänger steht: <strong>M-02</strong>.</p>
    <p>„Moment – den kenne ich.“</p>
    <p>Er dreht den Schlüssel zwischen den Fingern.</p>
    <p>„Mechaniklabor. Gleich hier am Flur. Vielleicht finden wir dort etwas, das mir auf die Sprünge hilft.“</p>
    <p>Mr. Laser blickt zur unscheinbaren Tür neben dem Hauptflur.</p>`,
  `<button class="button button-primary" data-route="follow-up-questions">Zum Mechaniklabor</button>`);

const mechanicsFindScreen = () => frame("Mechaniklabor", "Das gefaltete Blatt", `
    <p>Als Mr. Laser den Kunststoffblock zurückstellt, fällt sein Blick unter die Schiene.</p>
    <p>„Da liegt noch etwas.“ Zwischen Tischplatte und Schiene steckt ein gefaltetes Blatt.</p>
    <p class="lead"><strong>VERSUCHSREIHE M-02</strong></p>
    <p><strong>Versuchsleitung: J. Laser<br />Datum: 22. Juli<br />Messreihe abgebrochen.<br />Fortsetzung: Energielabor.</strong></p>
    <p>Mr. Laser sagt zunächst nichts. Er hält den Schlüsselanhänger neben das Blatt. Auf beiden steht: <strong>M-02</strong>.</p>
    <p>„Das steht auch auf meinem Schlüssel.“</p>
    <p>Dann bemerkt er das Datum. „Aber zu diesem Zeitpunkt waren Sommerferien.“</p>
    <p>Er sieht wieder auf seinen Namen. „Ich kann mich an diesen Versuch nicht erinnern.“</p>`,
  `<button class="button button-primary" data-route="follow-up-questions">Zum Energielabor</button>`);

const energyCliffhangerScreen = () => frame("Energielabor", "Ein neues Signal", `
    <p>Ein leises Piepen unterbricht die Stille.</p>
    <p>Mr. Laser dreht sich um. Am anderen Ende des Tisches ist ein Display aufgeleuchtet.</p>
    <p>„Die Anzeige war eben noch nicht da.“</p>
    <p class="lead"><strong>SIGNAL ERKANNT<br />QUELLE: UNBEKANNT</strong></p>
    <p>Mr. Laser sieht auf den Wasserbehälter. Dann auf das Display.</p>
    <p>„Das kommt nicht aus diesem Raum.“</p>`,
  `<button class="button button-primary" data-route="follow-up-complete">Weiter</button>`);

const maintenanceNotice = `
  <aside class="maintenance-notice" aria-label="Wartungshinweis Elektrische Messungen">
    <p class="lead"><strong>Wartungshinweis – Elektrische Messungen</strong></p>
    <p><strong>Amperemeter</strong><br />misst die Stromstärke.<br />Einheit: Ampere (A).<br />wird in Reihe geschaltet.</p>
    <p><strong>Voltmeter</strong><br />misst die Spannung.<br />Einheit: Volt (V).<br />wird parallel geschaltet.</p>
  </aside>`;

const electroTransitionScreen = () => frame("Elektrolabor", "Die Messstation", `
    <p>Mr. Laser: „Das Signal ist verschwunden... aber hier gibt es noch Energie. Vielleicht können wir die Messstation wieder aktivieren.“</p>
    <p>Mr. Laser: „Wenn wir wissen, wie die Messgeräte angeschlossen werden und welche Größen wir messen, können wir das Signal vielleicht zurückholen.“</p>
    ${maintenanceNotice}
    <p>Mr. Laser: „Zum Glück haben die früher sogar Anleitungen aufgehängt. Das spart uns hoffentlich etwas Zeit.“</p>`,
  `<button class="button button-primary" data-route="electro-questions">Wartungshinweis gelesen</button>`);

const electroCompleteScreen = () => frame("Elektrolabor", "Das Terminal", `
    <p>Nach der Eingabe von <strong>20 Ω</strong> springt die Anlage an. Ein altes Terminal flackert.</p>
    <p class="lead"><strong>SIGNAL WIEDERHERGESTELLT</strong></p>
    <p><strong>Verbindung nur für 2,4 Sekunden stabil.</strong></p>
    <p class="terminal-fragment" aria-label="Fragment der wiederhergestellten Übertragung"><strong>⌁<br />RAUMKENNUNG: E-17<br />ZIEL: CHEM—<br />NACHRICHT: ...M-02/B... die Station ist nicht verlassen. Sucht nach—</strong></p>
    <p>Mr. Laser: „Das war kein Zufall. Irgendjemand hat versucht, dieses Signal zu senden.“</p>`,
  `<button class="button button-primary" data-route="chemistry-transition">Untersuchung fortsetzen</button>`);

const waterReference = `
  <aside class="maintenance-notice" aria-label="Referenzinformation Wasser">
    <p class="lead"><strong>Referenzstoff Wasser</strong></p>
    <p>Unter normalen Druckbedingungen kann Wasser bei steigender Temperatur die Aggregatzustände <strong>fest → flüssig → gasförmig</strong> durchlaufen.</p>
    <p>Diese Beobachtung am Wasser ist der Referenzrahmen für den Versuch. Sie ist keine pauschale Regel für jeden Stoff unter allen Bedingungen.</p>
  </aside>`;

const chemistryTransitionScreen = () => frame("Chemielabor", "Die Spur M-02/B", `
    <p>Das Terminalfragment <strong>CHEM—</strong> führt Mr. Laser und euch gemeinsam in das Chemielabor.</p>
    <p>Auf einer Arbeitsfläche steht eine versiegelte Halterung mit der Kennzeichnung <strong>PROBE M-02/B</strong>. Daneben befindet sich eine unbeschriftete Messreihe.</p>
    <p>Mr. Laser: „Bevor wir diese Probe beurteilen, brauchen wir einen bekannten Vergleich.“</p>
    ${waterReference}`,
  `<button class="button button-primary" data-route="chemistry-questions">Referenzversuch starten</button>`);

const chemistryCompleteScreen = () => frame("Chemielabor", "Die Kennzeichnung", `
    <p>Der Kontrollversuch mit Wasser ist erwartungsgemäß verlaufen. Ein offensichtlicher allgemeiner Messfehler reicht als einfache Erklärung nicht aus.</p>
    <p>Die unbekannte Probe zeigt unter den untersuchten Bedingungen ein ungewöhnliches Verhalten. Ursache und Herkunft bleiben offen.</p>
    <p class="lead"><strong>M-02/B</strong></p>
    <p>Mr. Laser: „M-02.“</p>
    <p>Er schweigt einen Moment.</p>
    <p>„Diese Kennzeichnung kenne ich. Aber ich weiß nicht mehr, woher.“</p>`,
  `<button class="button button-primary" data-route="end">Untersuchung fortsetzen</button>`);

const chemistryScenes = Object.freeze({
  1: [
    "Mr. Laser stellt zuerst drei geschlossene Wasserproben in die Messstation.",
    "„Wasser kennen wir. Daran prüfen wir, ob unsere Beschreibung der Aggregatzustände stimmt.“"
  ],
  2: [
    "Die Referenzstation erwärmt und kühlt Wasser unter normalen Laborbedingungen.",
    "Im Protokoll fehlen die Fachbegriffe für die Übergänge."
  ],
  3: [
    "Erst jetzt setzt Mr. Laser die unbekannte Probe M-02/B in die zweite Halterung.",
    "Die Station führt mit Wasser und M-02/B dieselbe protokollierte Temperaturänderung durch."
  ],
  4: [
    "Mr. Laser starrt auf die Anzeige. „Das kann nicht stimmen. Prüfen wir zuerst, ob wir einen Fehler gemacht haben.“",
    "Er wiederholt den Ablauf mit einer frischen Wasserprobe. Wasser verhält sich erneut erwartungsgemäß.",
    "Die Kontrolle macht einen offensichtlichen allgemeinen Messfehler weniger wahrscheinlich, erklärt M-02/B aber noch nicht."
  ]
});

const followUpScenes = Object.freeze({
  1: [
    "Auf einem Versuchstisch stehen noch Geräte. Nichts wirkt beschädigt. Es sieht aus, als hätte jemand den Raum einfach verlassen.",
    "Auf einer Metallschiene steht ein kleiner Versuchswagen. Daneben liegen ein Federkraftmesser und handschriftliche Notizen.",
    "Mr. Laser betrachtet den Aufbau. „Den kenne ich. Zumindest glaube ich das. Hier fehlen Teile des Protokolls. Vielleicht können wir herausfinden, was hier gemacht wurde.“"
  ],
  2: [
    "Mr. Laser schiebt den Wagen langsam über die Schiene. „Kraftmessung. Bewegung.“",
    "Er betrachtet die restlichen Unterlagen. „Hier muss noch mehr gewesen sein.“",
    "Auf der Schiene befinden sich Messpunkte; daneben stehen Weg- und Zeitmessungen. „Offenbar wurde auch die Geschwindigkeit des Wagens bestimmt.“"
  ],
  3: [
    "Mr. Laser fährt mit dem Finger über die Messwerte. „Die Zahlen passen zusammen.“",
    "Dann bemerkt er einen kleinen Kunststoffblock neben der Schiene. Auf seiner Unterseite befindet sich dieselbe Markierung wie auf den Messblättern.",
    "Er stellt ihn auf den Wagen. „Dann wurde offenbar auch untersucht, was beim Abbremsen passiert.“"
  ],
  4: [
    "Im Energielabor führt Mr. Laser euch zu einem großen Arbeitstisch.",
    "Kabel, eine Lampe, mehrere Bauteile und zwei Messgeräte bilden einen Versuchsaufbau. Er legt das gefundene Protokoll daneben.",
    "„Wenn das wirklich die Fortsetzung ist, sollten wir zuerst herausfinden, wie dieser Aufbau funktioniert.“"
  ],
  5: [
    "Mr. Laser folgt den Leitungen mit dem Finger. „Gut. Damit wissen wir zumindest, wie gemessen wurde.“",
    "Neben dem Aufbau liegen zwei weitere Bauteile. Im Protokoll ist ein Widerstand durchgestrichen, daneben steht ein zweiter Wert. Die Spannung wurde nicht verändert.",
    "„Offenbar wurde nur der Widerstand ausgetauscht.“"
  ],
  6: [
    "Mr. Laser betrachtet die Messwerte. „Das erklärt sie.“ Dann folgt er einem Kabel zu einem weiteren Gerät.",
    "„Das allerdings erklärt noch nicht, wozu das hier gut sein sollte.“",
    "Der Aufbau verbindet eine Lichtquelle, eine Solarzelle, einen Energiespeicher, eine Kontrollleuchte und ein Bauteil, das im Betrieb warm wird."
  ],
  7: [
    "Mr. Laser liest die Messwerte ein zweites Mal. „Das funktioniert. Aber ich verstehe immer noch nicht, warum ich das aufgebaut haben sollte.“",
    "Ein Kabel führt über die Tischkante zu einem durchsichtigen Wasserbehälter. Daneben liegen kleine Probekörper und ein Zettel mit ihren Dichten.",
    "Mr. Laser blickt vom Aufbau zum Wasser. „Mechanik. Elektrizität. Energie. Und jetzt das. Was habe ich hier untersucht?“"
  ],
  8: [
    "Im Elektrolabor steht ein einfacher Stromkreis mit Lampe, Batterie und Schalter bereit.",
    "Die Messstation reagiert noch nicht. Zuerst müssen Amperemeter und Voltmeter richtig angeschlossen werden."
  ],
  9: [
    "Die korrekte Schaltung aktiviert die Messstation.",
    "Auf dem Bildschirm erscheinen Messkarten für die elektrischen Größen."
  ],
  10: [
    "Die Zuordnungen werden bestätigt. Für den Neustart fehlt nur noch ein Widerstandswert.",
    "Das Display zeigt die gemessene Spannung und Stromstärke."
  ]
});

const followUpRoomName = (order) => order <= 3 ? "Mechaniklabor" : order <= 7 ? "Energielabor" : "Elektrolabor";

export const createScreens = (data, engine, diagnostics, followUp = null, electroLab = null, chemistryLab = null) => ({
  welcome: welcomeScreen,

  start: () => frame("Greenville High School", "Willkommen", `
    <p class="lead">Eine Physikerkundung</p>
    <p>Begleite Mr. Laser durch die ungewöhnlich stille Schule.</p>`, `
      <button class="button button-primary" data-action="start-mission">Mission starten</button>
      <button class="button" data-route="settings">Einstellungen</button>
      <button class="button" data-route="about">Über</button>`),

  briefing: () => frame("Erster Schultag", `Willkommen, ${escapeHtml(data.player.displayName || "Crewmitglied")}`, `
    <p>Nach den Sommerferien wirkt die Greenville High School ungewöhnlich still. Im Flur wartet Mr. Laser – offenbar als Einziger.</p>`,
    `<button class="button button-primary" data-route="mr-laser">Zu Mr. Laser</button>`),

  "mr-laser": () => frame("Im Flur", "Mr. Laser", `
    <p>Der Flur ist still. Viel zu still für einen normalen Schultag.</p>
    <p>Mr. Laser steht allein vor einem eingeschalteten Smartboard. Er tippt auf den Bildschirm, wischt darüber und tritt schließlich einen Schritt zurück.</p>
    <p>Dann bemerkt er euch. Für einen Moment wirkt er erleichtert.</p>
    <p>„Ah. Gut. Ihr seid da.“ Er deutet auf das Smartboard.</p>
    <p>Mr. Laser schaut wieder auf das Smartboard.</p>
    <p>„Könnt ihr mir damit helfen? Ich komme damit gerade nicht weiter.“</p>
    <p>Für einen Moment betrachtet er die Aufgabe, als müsste sie ihm eigentlich bekannt vorkommen.</p>
    <p>„Vielleicht versteht ihr besser, was das Ding von uns will.“</p>
    <p>Auf dem Smartboard erscheint die erste Aufgabe.</p>`,
    `<button class="button button-primary" data-route="questions">Zum Smartboard</button>`),

  // Compatibility alias for saved v0.7 states and direct legacy URLs. The
  // regular student flow links directly from welcome to briefing.
  diagnostics: () => frame("Erster Schultag", `Willkommen, ${escapeHtml(data.player.displayName || "Crewmitglied")}`, `
    <p>Nach den Sommerferien wirkt die Greenville High School ungewöhnlich still. Im Flur wartet Mr. Laser – offenbar als Einziger.</p>`,
    `<button class="button button-primary" data-route="mr-laser">Zu Mr. Laser</button>`),

  questions: () => {
    const question = diagnostics.getCurrentTask();
    if (!question) return frame("Mission", "Keine Aufgabe verfügbar", `<p>Für diese Mission wurde keine Aufgabe geladen.</p>`, `<button class="button" data-route="briefing">Zur Mission</button>`);
    const strategy = getAnswerTypeStrategy(question.antworttyp);
    if (!strategy) return frame("Mission", question.titel, `<p>Diese Aufgabe kann derzeit nicht dargestellt werden.</p>`, `<button class="button" data-route="briefing">Zurück</button>`);
    const requiresSelection = ["single-choice", "multiple-choice"].includes(question.antworttyp);
    const sequenceTasks = data.questions ?? [];
    const questionIndex = Math.max(0, sequenceTasks.findIndex((entry) => entry.id === question.id));
    const sequenceOrder = questionIndex + 1;
    const sequenceLength = sequenceTasks.length || 10;
    return frame(`Smartboard · Sequenz ${String(sequenceOrder).padStart(2, "0")} / ${String(sequenceLength).padStart(2, "0")}`, question.titel, `
      ${entrySequenceStory(sequenceOrder)}
      <h2>${escapeHtml(question.aufgabe)}</h2>
      <form id="question-form" data-question-id="${escapeHtml(question.id)}" data-answer-type="${escapeHtml(question.antworttyp)}">${strategy.render(question, { escapeHtml })}</form>
      <p id="answer-feedback" class="hint" aria-live="polite"></p>`,
      `<button class="button button-primary" data-action="check-answer"${requiresSelection ? " disabled" : ""}>Eingabe bestätigen</button>`);
  },

  "entry-transition": entryTransitionScreen,
  // Compatible v0.7 saves may still name one of the former screens. They all
  // render the same student-safe transition and never expose evaluation data.
  evaluation: entryTransitionScreen,
  "entry-feedback": entryTransitionScreen,
  "entry-ready": entryTransitionScreen,
  "mechanics-transition": mechanicsTransitionScreen,
  "mechanics-find": mechanicsFindScreen,
  "energy-cliffhanger": energyCliffhangerScreen,
  "electro-transition": electroTransitionScreen,
  "electro-complete": electroCompleteScreen,
  "chemistry-transition": chemistryTransitionScreen,
  "chemistry-complete": chemistryCompleteScreen,

  "electro-questions": () => {
    const question = electroLab?.getCurrentTask();
    if (!question) return electroCompleteScreen();
    const strategy = getAnswerTypeStrategy(question.antworttyp);
    if (!strategy) return frame("Elektrolabor", question.titel, `<p>Diese Untersuchung kann derzeit nicht dargestellt werden.</p>`);
    return frame("Elektrolabor", question.titel, `
      ${followUpScenes[question.reihenfolge].map((paragraph) => `<p class="story">${escapeHtml(paragraph)}</p>`).join("")}
      <p class="story">${escapeHtml(question.story)}</p>
      ${question.path === "support" && question.reihenfolge === 8 ? maintenanceNotice : ""}
      ${question.hilfe ? `<p class="hint">${escapeHtml(question.hilfe)}</p>` : ""}
      <h2>${escapeHtml(question.aufgabe)}</h2>
      <form id="electro-form" data-answer-type="${escapeHtml(question.antworttyp)}">${strategy.render(question, { escapeHtml })}</form>
      <p id="answer-feedback" class="hint" aria-live="polite"></p>`,
      `<button class="button button-primary" data-action="check-electro" disabled>Untersuchung fortsetzen</button>`);
  },

  "chemistry-questions": () => {
    const question = chemistryLab?.getCurrentTask();
    if (!question) return chemistryCompleteScreen();
    const strategy = getAnswerTypeStrategy(question.antworttyp);
    if (!strategy) return frame("Chemielabor", question.titel, `<p>Diese Untersuchung kann derzeit nicht dargestellt werden.</p>`);
    return frame("Chemielabor", question.titel, `
      ${chemistryScenes[question.reihenfolge].map((paragraph) => `<p class="story">${escapeHtml(paragraph)}</p>`).join("")}
      <p class="story">${escapeHtml(question.story)}</p>
      ${question.path === "support" && question.reihenfolge === 1 ? waterReference : ""}
      ${question.hilfe ? `<p class="hint">${escapeHtml(question.hilfe)}</p>` : ""}
      <h2>${escapeHtml(question.aufgabe)}</h2>
      <form id="chemistry-form" data-answer-type="${escapeHtml(question.antworttyp)}">${strategy.render(question, { escapeHtml })}</form>
      <p id="answer-feedback" class="hint" aria-live="polite"></p>`,
      `<button class="button button-primary" data-action="check-chemistry" disabled>Untersuchung fortsetzen</button>`);
  },

  "follow-up-questions": () => {
    const question = followUp?.getCurrentTask();
    if (!question) return frame("Energielabor", "Die Untersuchung ist beendet", `<p>Im Raum ist es wieder still.</p>`,
      `<button class="button button-primary" data-route="follow-up-complete">Weiter</button>`);
    const strategy = getAnswerTypeStrategy(question.antworttyp);
    if (!strategy) return frame(followUpRoomName(question.reihenfolge), question.titel, `<p>Diese Untersuchung kann derzeit nicht dargestellt werden.</p>`);
    return frame(followUpRoomName(question.reihenfolge), question.titel, `
      ${followUpScenes[question.reihenfolge].map((paragraph) => `<p class="story">${escapeHtml(paragraph)}</p>`).join("")}
      <p class="story">${escapeHtml(question.story)}</p>
      ${question.path === "support" && question.reihenfolge === 8 ? maintenanceNotice : ""}
      ${question.hilfe ? `<p class="hint">${escapeHtml(question.hilfe)}</p>` : ""}
      <h2>${escapeHtml(question.aufgabe)}</h2>
      <form id="follow-up-form" data-answer-type="${escapeHtml(question.antworttyp)}">${strategy.render(question, { escapeHtml })}</form>
      <p id="answer-feedback" class="hint" aria-live="polite"></p>`,
      `<button class="button button-primary" data-action="check-follow-up" disabled>Untersuchung fortsetzen</button>`);
  },

  "follow-up-complete": () => frame("Energielabor", "Das Signal verstummt", `
    <p>So plötzlich, wie die Anzeige erschienen ist, verschwindet sie wieder.</p>
    <p>Mr. Laser nimmt den Schlüsselbund vom Tisch.</p>
    <p>„Ich glaube, wir sollten herausfinden, woher es kommt.“</p>`,
    `<button class="button button-primary" data-route="electro-transition">Zum Elektrolabor</button>`),

  "repair-area": () => frame("Greenville High School", "Dieser Bereich ist noch verschlossen", `<p>Von hier aus führt im Moment kein Weg weiter.</p>`, `<button class="button" data-route="research-area">Zur nächsten Tür</button>`),
  "research-area": () => frame("Greenville High School", "Eine verschlossene Tür", `<p>Hinter der Tür bleibt alles still.</p>`, `<button class="button" data-route="end">Zurück</button>`),
  end: () => frame("Greenville High School", "Für heute endet die Spur hier", `<p>Dein Spielstand kann für die nächste Erkundung gespeichert werden.</p>`, `<button class="button button-primary" data-action="restart">Zurück zum Start</button>`),
  settings: () => frame("Einstellungen", "Spielstand", `
    <p>Spielerinformationen, Antworten, Lernfortschritt und Spielstatus können lokal gespeichert werden.</p>
    <p class="hint">Datenschutzhinweis: Spielstände und Antworten werden nur auf diesem Gerät gespeichert. Exportierte Spielstände sind nicht verschlüsselt und können sensible pädagogische Angaben enthalten.</p>
    <input id="storage-import-file" type="file" accept="application/json,.json" hidden />
    <p id="storage-feedback" class="hint" aria-live="polite"></p>`, `
    <button class="button button-primary" data-action="save-state">Speichern</button>
    <button class="button" data-action="load-state">Laden</button>
    <button class="button" data-action="export-state">Exportieren</button>
    <button class="button" data-action="choose-import">Importieren</button>
    <button class="button" data-action="clear-state">Gespeicherten Stand löschen</button>
    <button class="button" data-route="start">Zurück</button>`),
  about: () => frame("Über", "Greenville High School", `<p>Eine offlinefähige Physikerkundung mit Mr. Laser.</p>`, `<button class="button" data-route="start">Zurück</button>`)
});

export const bindUiEvents = (root, router, engine, diagnostics, evaluation, review, routing, entryPathAssigner, followUp, tasks, persistence, mapPhase = null, electroLab = null, chemistryLab = null) => {
  const followUpAttempts = new Map();
  root.addEventListener("change", (event) => {
    if (event.target.matches("#question-form input, #follow-up-form input, #electro-form input, #chemistry-form input, #question-form select, #follow-up-form select, #electro-form select, #chemistry-form select")) {
      updateAnswerSubmitState(event.target.form, root.querySelector("[data-action='check-answer'], [data-action='check-follow-up'], [data-action='check-electro'], [data-action='check-chemistry']"));
    }
  });
  root.addEventListener("input", (event) => {
    if (event.target.matches("#question-form input, #question-form textarea, #follow-up-form input, #follow-up-form textarea, #electro-form input, #electro-form textarea, #chemistry-form input, #chemistry-form textarea")) {
      updateAnswerSubmitState(event.target.form, root.querySelector("[data-action='check-answer'], [data-action='check-follow-up'], [data-action='check-electro'], [data-action='check-chemistry']"));
    }
  });
  root.addEventListener("click", (event) => {
    const route = event.target.closest("[data-route]")?.dataset.route;
    if (route) {
      mapPhase?.handleScreen(route);
      if (route === "follow-up-questions") {
        mapPhase?.enterFollowUpStep(followUp.getCurrentTask()?.reihenfolge);
      } else if (route === "electro-transition") {
        mapPhase?.enterElectroLab();
      } else if (route === "chemistry-transition") {
        mapPhase?.enterChemistryLab();
      }
      router.go(route);
      if (["follow-up-questions", "electro-transition", "chemistry-transition"].includes(route)) {
        try { persistence.save(); } catch (error) { console.error(error); }
      }
    }

    if (event.target.closest("[data-action='start-mission']")) {
      diagnostics.reset();
      electroLab?.reset();
      chemistryLab?.reset();
      engine.reset();
      router.go("briefing");
    }
    if (event.target.closest("[data-action='restart']")) {
      diagnostics.reset();
      electroLab?.reset();
      chemistryLab?.reset();
      engine.reset();
      router.go("start");
    }
    if (event.target.closest("[data-action='save-state']")) {
      try {
        persistence.save();
        showStorageFeedback(root, "Spielstand gespeichert.");
      } catch (error) {
        console.error(error);
        showStorageFeedback(root, storageErrorMessage(error));
      }
      return;
    }
    if (event.target.closest("[data-action='load-state']")) {
      try {
        const loaded = persistence.load();
        if (!loaded) return showStorageFeedback(root, "Es ist kein gespeicherter Spielstand vorhanden.");
        router.go(engine.getState().currentScreen);
      } catch (error) {
        console.error(error);
        showStorageFeedback(root, storageErrorMessage(error));
      }
      return;
    }
    if (event.target.closest("[data-action='export-state']")) {
      try {
        const blob = new Blob([persistence.export()], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "greenville-spielstand-v07.json";
        link.click();
        URL.revokeObjectURL(url);
        showStorageFeedback(root, "Spielstand als unverschlüsselte Datei exportiert.");
      } catch (error) {
        console.error(error);
        showStorageFeedback(root, storageErrorMessage(error));
      }
      return;
    }
    if (event.target.closest("[data-action='choose-import']")) {
      root.querySelector("#storage-import-file")?.click();
      return;
    }
    if (event.target.closest("[data-action='clear-state']")) {
      try {
        persistence.clear();
        showStorageFeedback(root, "Gespeicherter Spielstand gelöscht. Der aktuelle Laufzeitzustand bleibt bestehen.");
      } catch (error) {
        console.error(error);
        showStorageFeedback(root, storageErrorMessage(error));
      }
      return;
    }
    if (event.target.closest("[data-action='check-answer']")) {
      const form = root.querySelector("#question-form");
      const strategy = form && getAnswerTypeStrategy(form.dataset.answerType);
      const answer = strategy?.readAnswer(form);
      if (!form || !strategy || answer === null) {
        const feedback = root.querySelector("#answer-feedback");
        if (feedback) feedback.textContent = "Bitte wähle mindestens eine Antwort aus.";
        return;
      }
      diagnostics.recordAnswer(form.dataset.questionId, answer);
      const nextQuestion = diagnostics.nextTask();
      if (!nextQuestion) {
        const answers = diagnostics.getSnapshot().answers;
        completeEntryAssessment({
          answers, tasks, evaluation, review, routing, entryPathAssigner, engine, router, persistence
        });
        return;
      }
      router.go("questions");
    }
    if (event.target.closest("[data-action='check-follow-up']")) {
      const form = root.querySelector("#follow-up-form");
      const strategy = form && getAnswerTypeStrategy(form.dataset.answerType);
      const answer = strategy?.readAnswer(form);
      if (!form || !strategy || answer === null) {
        const feedback = root.querySelector("#answer-feedback");
        if (feedback) feedback.textContent = "Bitte wähle mindestens eine Antwort aus.";
        return;
      }
      const currentTask = followUp.getCurrentTask();
      if (currentTask.wiederholenBisRichtig && strategy.evaluate(currentTask, answer) !== true) {
        const attempts = (followUpAttempts.get(currentTask.id) ?? 0) + 1;
        followUpAttempts.set(currentTask.id, attempts);
        const optionalHint = currentTask.mrLaserHinweis && attempts >= (currentTask.hinweisNachFehlern ?? 2)
          ? ` Mr. Laser: „${currentTask.mrLaserHinweis}“`
          : "";
        const feedback = root.querySelector("#answer-feedback");
        if (feedback) feedback.textContent = `${currentTask.fehlermeldung ?? "Messung fehlgeschlagen."}${optionalHint}`;
        return;
      }
      const completedOrder = currentTask.reihenfolge;
      followUp.recordAnswer(currentTask.id, answer);
      const nextQuestion = followUp.nextTask();
      mapPhase?.completeFollowUpStep(completedOrder);
      const nextScreen = nextFollowUpStoryScreen(completedOrder, nextQuestion);
      if (["energy-cliffhanger", "electro-complete"].includes(nextScreen)) {
        engine.setFollowUpEvaluation(evaluation.evaluate(followUp.getActiveTasks(), followUp.exportState().answers));
        router.go(nextScreen);
      } else if (nextScreen === "mechanics-find") {
        router.go(nextScreen);
      } else {
        mapPhase?.enterFollowUpStep(nextQuestion.reihenfolge);
        router.go(nextScreen);
      }
      try { persistence.save(); } catch (error) { console.error(error); }
      return;
    }
    if (event.target.closest("[data-action='check-electro']")) {
      const form = root.querySelector("#electro-form");
      const strategy = form && getAnswerTypeStrategy(form.dataset.answerType);
      const answer = strategy?.readAnswer(form);
      const currentTask = electroLab?.getCurrentTask();
      if (!form || !strategy || answer === null || !currentTask) {
        const feedback = root.querySelector("#answer-feedback");
        if (feedback) feedback.textContent = "Bitte wähle mindestens eine Antwort aus.";
        return;
      }
      if (strategy.evaluate(currentTask, answer) !== true) {
        const attempts = (followUpAttempts.get(currentTask.id) ?? 0) + 1;
        followUpAttempts.set(currentTask.id, attempts);
        const optionalHint = currentTask.mrLaserHinweis && attempts >= (currentTask.hinweisNachFehlern ?? 2)
          ? ` Mr. Laser: „${currentTask.mrLaserHinweis}“`
          : "";
        const feedback = root.querySelector("#answer-feedback");
        if (feedback) feedback.textContent = `${currentTask.fehlermeldung ?? "Messung fehlgeschlagen."}${optionalHint}`;
        return;
      }
      electroLab.recordAnswer(currentTask.id, answer);
      const nextTask = electroLab.nextTask();
      if (!nextTask) mapPhase?.completeElectroLab();
      router.go(nextTask ? "electro-questions" : "electro-complete");
      if (!nextTask) {
        try { persistence.save(); } catch (error) { console.error(error); }
      }
      return;
    }
    if (event.target.closest("[data-action='check-chemistry']")) {
      const form = root.querySelector("#chemistry-form");
      const strategy = form && getAnswerTypeStrategy(form.dataset.answerType);
      const answer = strategy?.readAnswer(form);
      const currentTask = chemistryLab?.getCurrentTask();
      if (!form || !strategy || answer === null || !currentTask) {
        const feedback = root.querySelector("#answer-feedback");
        if (feedback) feedback.textContent = "Bitte bearbeitet alle Teile der Aufgabe.";
        return;
      }
      if (strategy.evaluate(currentTask, answer) !== true) {
        const attempts = (followUpAttempts.get(currentTask.id) ?? 0) + 1;
        followUpAttempts.set(currentTask.id, attempts);
        const optionalHint = currentTask.mrLaserHinweis && attempts >= (currentTask.hinweisNachFehlern ?? 2)
          ? ` Mr. Laser: „${currentTask.mrLaserHinweis}“`
          : "";
        const feedback = root.querySelector("#answer-feedback");
        if (feedback) feedback.textContent = `${currentTask.fehlermeldung ?? "Auswertung nicht bestätigt."}${optionalHint}`;
        return;
      }
      chemistryLab.recordAnswer(currentTask.id, answer);
      const nextTask = chemistryLab.nextTask();
      if (!nextTask) mapPhase?.completeChemistryLab();
      router.go(nextTask ? "chemistry-questions" : "chemistry-complete");
      if (!nextTask) {
        try { persistence.save(); } catch (error) { console.error(error); }
      }
      return;
    }
  });

  root.addEventListener("change", async (event) => {
    if (event.target.id !== "storage-import-file") return;
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const envelope = persistence.import(await file.text());
      router.go(engine.getState().currentScreen);
      return envelope;
    } catch (error) {
      console.error(error);
      showStorageFeedback(root, storageErrorMessage(error));
    } finally {
      event.target.value = "";
    }
  });
};
