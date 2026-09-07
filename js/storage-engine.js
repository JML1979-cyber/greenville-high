import { APP_VERSION } from "./version.js";
import { validateEntryPathAssignment } from "./entry-path-assigner.js";

export const STORAGE_FORMAT = "greenville-player-state";
export const STORAGE_SCHEMA_VERSION = 1;
export const STORAGE_APP_VERSION = APP_VERSION;

const DEFAULT_STORAGE_KEY = "greenville-engine.player-state";
const clone = (value) => structuredClone(value);
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export class StorageEngineError extends Error {
  constructor(code, message, cause = null) {
    super(message, cause ? { cause } : undefined);
    this.name = "StorageEngineError";
    this.code = code;
  }
}

const invalid = (message) => new StorageEngineError("INVALID_STRUCTURE", message);

/**
 * Versioned persistence boundary. No module outside this file accesses
 * localStorage; a compatible storage adapter can be injected for tests or
 * future persistence backends.
 */
export class StorageEngine {
  constructor({
    storage,
    storageKey = DEFAULT_STORAGE_KEY,
    missionId,
    taskIds,
    clock = () => new Date().toISOString(),
    entryPathAssigner = null,
    pathTaskIds = null
  } = {}) {
    let resolvedStorage = storage;
    let unavailableCause = null;
    if (resolvedStorage === undefined) {
      try { resolvedStorage = globalThis.localStorage; } catch (error) { unavailableCause = error; }
    }
    if (!resolvedStorage || typeof resolvedStorage.getItem !== "function" || typeof resolvedStorage.setItem !== "function" || typeof resolvedStorage.removeItem !== "function") {
      unavailableCause ??= new Error("Kein kompatibler Speicheradapter verfügbar.");
      resolvedStorage = null;
    }
    if (typeof missionId !== "string" || !missionId.trim()) throw invalid("Eine stabile Missionskennung wird benötigt.");
    if (!Array.isArray(taskIds) || !taskIds.length || taskIds.some((id) => typeof id !== "string" || !id)) {
      throw invalid("Die Aufgaben-IDs des aktuellen Aufgabensatzes sind ungültig.");
    }
    this.storage = resolvedStorage;
    this.unavailableCause = unavailableCause;
    this.storageKey = storageKey;
    this.missionId = missionId;
    this.taskIds = [...taskIds];
    this.clock = clock;
    this.entryPathAssigner = entryPathAssigner;
    this.pathTaskIds = pathTaskIds ? clone(pathTaskIds) : null;
    // Reserved for real, explicit future migrations. Version 0.7 registers none.
    this.migrations = new Map();
  }

  savePlayerState(playerState, extensions = {}) {
    const envelope = this.createEnvelope(playerState, extensions);
    this.write(JSON.stringify(envelope));
    return clone(envelope);
  }

  loadPlayerState() {
    const serialized = this.read();
    if (serialized === null) return null;
    const { envelope, migrated } = this.parseValidateWithMetadata(serialized);
    if (migrated) this.write(JSON.stringify(envelope));
    return envelope;
  }

  clearPlayerState() {
    try {
      this.storage.removeItem(this.storageKey);
    } catch (error) {
      throw this.storageError(error);
    }
  }

  exportPlayerState() {
    const envelope = this.loadPlayerState();
    if (!envelope) throw new StorageEngineError("NO_SAVED_STATE", "Es ist kein gespeicherter Spielstand vorhanden.");
    return JSON.stringify(envelope, null, 2);
  }

  importPlayerState(serializedState) {
    // Validation is deliberately complete before the existing value is touched.
    const envelope = this.parseAndValidate(serializedState);
    const previous = this.read();
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(envelope));
    } catch (error) {
      if (previous !== null) {
        try { this.storage.setItem(this.storageKey, previous); } catch { /* Keep original error. */ }
      }
      throw this.storageError(error);
    }
    return clone(envelope);
  }

  createEnvelope(playerState, extensions = {}) {
    const envelope = {
      format: STORAGE_FORMAT,
      schemaVersion: STORAGE_SCHEMA_VERSION,
      appVersion: STORAGE_APP_VERSION,
      savedAt: this.clock(),
      mission: {
        id: this.missionId,
        taskIds: [...this.taskIds]
      },
      state: clone(playerState),
      extensions: clone(extensions)
    };
    return this.validateEnvelope(envelope);
  }

  parseAndValidate(serialized) {
    return this.parseValidateWithMetadata(serialized).envelope;
  }

  parseValidateWithMetadata(serialized) {
    if (typeof serialized !== "string") throw invalid("Der importierte Spielstand muss als JSON-Text vorliegen.");
    let envelope;
    try {
      envelope = JSON.parse(serialized);
    } catch (error) {
      throw new StorageEngineError("CORRUPT_DATA", "Die Spielstanddatei ist beschädigt oder kein gültiges JSON.", error);
    }
    const migrated = this.prepareLegacyEntryPath(envelope);
    return { envelope: this.validateEnvelope(envelope), migrated };
  }

  prepareLegacyEntryPath(envelope) {
    const engine = envelope?.state?.engine;
    if (!isObject(engine) || Object.hasOwn(engine, "entryPathAssignment")) return false;
    const answers = envelope?.state?.diagnostic?.answers;
    engine.entryPathAssignment = this.entryPathAssigner?.hasCompleteAutomaticAssessment(answers)
      ? this.entryPathAssigner.assign(answers)
      : null;
    return true;
  }

  validateEnvelope(envelope) {
    if (!isObject(envelope)) throw invalid("Der Spielstand besitzt keine gültige Objektstruktur.");
    if (envelope.format !== STORAGE_FORMAT) throw invalid("Die Datei ist kein Greenville-Spielstand.");
    if (envelope.schemaVersion !== STORAGE_SCHEMA_VERSION) {
      throw new StorageEngineError(
        "INCOMPATIBLE_VERSION",
        `Inkompatible Speicherformat-Version: erwartet ${STORAGE_SCHEMA_VERSION}, erhalten ${String(envelope.schemaVersion)}.`
      );
    }
    if (envelope.appVersion !== STORAGE_APP_VERSION || typeof envelope.savedAt !== "string" || Number.isNaN(Date.parse(envelope.savedAt))) {
      throw invalid("Anwendungsversion oder Speicherzeitpunkt fehlen beziehungsweise sind ungültig.");
    }
    this.validateMission(envelope.mission);
    this.validateState(envelope.state);
    if (!isObject(envelope.extensions)) throw invalid("Der Erweiterungsbereich des Spielstands ist ungültig.");
    return clone(envelope);
  }

  validateMission(mission) {
    if (!isObject(mission) || mission.id !== this.missionId) {
      throw new StorageEngineError("INCOMPATIBLE_MISSION", "Der Spielstand gehört zu einer anderen Mission oder einem anderen Aufgabensatz.");
    }
    if (!Array.isArray(mission.taskIds)
      || mission.taskIds.length !== this.taskIds.length
      || mission.taskIds.some((id, index) => id !== this.taskIds[index])) {
      throw new StorageEngineError("INCOMPATIBLE_MISSION", "Die Aufgaben-IDs des Spielstands stimmen nicht mit dem aktuellen Aufgabensatz überein.");
    }
  }

  validateState(state) {
    if (!isObject(state) || !isObject(state.engine) || !isObject(state.diagnostic)) {
      throw invalid("Zentraler Spielstatus oder Diagnosezustand fehlen.");
    }
    const diagnostic = state.diagnostic;
    if (!Number.isInteger(diagnostic.currentIndex) || diagnostic.currentIndex < 0 || diagnostic.currentIndex > this.taskIds.length) {
      throw invalid("Der aktuelle Aufgabenindex liegt außerhalb des gültigen Bereichs.");
    }
    if (!Array.isArray(diagnostic.answers) || !isObject(diagnostic.profile)) {
      throw invalid("Antworten oder Diagnoseprofil besitzen eine ungültige Struktur.");
    }
    this.validateReferences(diagnostic.answers, "fragenId", "Antwort");
    if (diagnostic.answers.length !== diagnostic.currentIndex) {
      throw invalid("Aufgabenindex und Zahl der gespeicherten Antworten sind inkonsistent.");
    }

    const engine = state.engine;
    const requiredArrays = ["answers", "reviews", "gamePath", "tags"];
    if (!isObject(engine.player) || requiredArrays.some((field) => !Array.isArray(engine[field]))) {
      throw invalid("Spieler-, Antwort-, Review- oder Spielstatusdaten sind ungültig.");
    }
    this.validateReferences(engine.answers, "fragenId", "Antwort");
    this.validateReferences(engine.reviews, "aufgabenId", "Sichtung");
    if (JSON.stringify(engine.answers) !== JSON.stringify(diagnostic.answers)) {
      throw invalid("Antworten im zentralen Status und Diagnosezustand sind inkonsistent.");
    }
    if (typeof engine.currentScreen !== "string") throw invalid("Der aktuelle Bildschirm ist ungültig.");
    try {
      engine.entryPathAssignment = validateEntryPathAssignment(engine.entryPathAssignment);
    } catch (error) {
      throw invalid(error.message);
    }
    for (const field of ["evaluation", "reviewedEvaluation", "recommendations"]) {
      if (engine[field] !== null && !isObject(engine[field])) throw invalid(`Das Feld ${field} ist ungültig.`);
    }
    if (engine.evaluation?.rohantworten && JSON.stringify(engine.evaluation.rohantworten) !== JSON.stringify(diagnostic.answers)) {
      throw invalid("Rohantworten und automatische Auswertung sind inkonsistent.");
    }
    if (engine.reviewedEvaluation?.sichtungsverlauf
      && JSON.stringify(engine.reviewedEvaluation.sichtungsverlauf) !== JSON.stringify(engine.reviews)) {
      throw invalid("Review-Verlauf und gesichtetes Kompetenzprofil sind inkonsistent.");
    }
    if (engine.followUpEvaluation !== null && engine.followUpEvaluation !== undefined && !isObject(engine.followUpEvaluation)) {
      throw invalid("Die Auswertung der Folgeaufgaben ist ungültig.");
    }
    this.validateFollowUpState(state.followUp, engine);
  }

  validateFollowUpState(followUp, engine) {
    if (followUp === undefined) return;
    if (!isObject(followUp)) {
      throw invalid("Der Folgeaufgabenstatus besitzt keinen gültigen Weg.");
    }
    if (followUp.path === null) {
      if (engine.entryPathAssignment !== null || followUp.currentIndex !== 0
        || !Array.isArray(followUp.answers) || followUp.answers.length !== 0 || !isObject(followUp.profile)) {
        throw invalid("Ein inaktiver Folgeaufgabenstatus enthält unerwarteten Fortschritt.");
      }
      return;
    }
    if (!["support", "extended"].includes(followUp.path)) throw invalid("Der Folgeaufgabenstatus besitzt keinen gültigen Weg.");
    if (followUp.path !== engine.entryPathAssignment?.path) {
      throw invalid("Folgeaufgabenstatus und Eingangszuweisung widersprechen sich.");
    }
    const knownIds = this.pathTaskIds?.[followUp.path];
    if (!Array.isArray(knownIds) || knownIds.length !== 7) throw invalid("Die Folgeaufgaben-IDs fehlen.");
    if (!Number.isInteger(followUp.currentIndex) || followUp.currentIndex < 0 || followUp.currentIndex > knownIds.length
      || !Array.isArray(followUp.answers) || !isObject(followUp.profile)
      || followUp.answers.length !== followUp.currentIndex) {
      throw invalid("Der Folgeaufgabenfortschritt ist ungültig.");
    }
    const known = new Set(knownIds);
    if (followUp.answers.some((answer) => !isObject(answer) || !known.has(answer.fragenId))) {
      throw new StorageEngineError("INCOMPATIBLE_MISSION", "Eine Folgeantwort referenziert eine unbekannte Aufgabe.");
    }
    if (engine.followUpEvaluation?.rohantworten
      && JSON.stringify(engine.followUpEvaluation.rohantworten) !== JSON.stringify(followUp.answers)) {
      throw invalid("Folgeantworten und Folgeauswertung sind inkonsistent.");
    }
  }

  validateReferences(entries, field, label) {
    const known = new Set(this.taskIds);
    entries.forEach((entry) => {
      if (!isObject(entry) || !known.has(entry[field])) {
        throw new StorageEngineError("INCOMPATIBLE_MISSION", `${label} referenziert eine unbekannte Aufgabe.`);
      }
    });
  }

  read() {
    this.assertStorageAvailable();
    try {
      return this.storage.getItem(this.storageKey);
    } catch (error) {
      throw this.storageError(error);
    }
  }

  write(serialized) {
    this.assertStorageAvailable();
    try {
      this.storage.setItem(this.storageKey, serialized);
    } catch (error) {
      throw this.storageError(error);
    }
  }

  storageError(error) {
    const isQuota = error?.name === "QuotaExceededError" || error?.code === 22 || error?.code === 1014;
    return new StorageEngineError(
      isQuota ? "STORAGE_QUOTA" : "STORAGE_BLOCKED",
      isQuota ? "Der lokale Speicher ist voll; der Spielstand konnte nicht gespeichert werden." : "Der Browser blockiert den lokalen Speicher.",
      error
    );
  }

  assertStorageAvailable() {
    if (!this.storage) {
      throw new StorageEngineError("STORAGE_BLOCKED", "Der Browser blockiert den lokalen Speicher.", this.unavailableCause);
    }
  }
}

/** Validates both targets before committing and rolls both back on any failure. */
export const restorePlayerStateAtomically = (persistedState, { engine, diagnostics, followUp = null }) => {
  if (!isObject(persistedState) || !isObject(persistedState.engine) || !isObject(persistedState.diagnostic)) {
    throw invalid("Der wiederherzustellende Gesamtzustand ist ungültig.");
  }

  const previousEngine = engine.getState();
  const previousDiagnostic = diagnostics.exportState();
  const previousFollowUp = followUp?.exportState() ?? null;
  const preparedEngine = engine.prepareStateRestore(persistedState.engine);
  const preparedDiagnostic = diagnostics.prepareStateRestore(persistedState.diagnostic);
  const preparedFollowUp = followUp && preparedEngine.entryPathAssignment
    ? followUp.prepareStateRestore(persistedState.followUp, preparedEngine.entryPathAssignment)
    : null;

  try {
    diagnostics.commitStateRestore(preparedDiagnostic);
    engine.commitStateRestore(preparedEngine);
    if (preparedFollowUp) followUp.commitStateRestore(preparedFollowUp);
  } catch (error) {
    if (followUp) {
      try {
        if (previousFollowUp?.path) followUp.commitStateRestore(previousFollowUp);
        else followUp.reset();
      } catch { /* Preserve original error. */ }
    }
    try { diagnostics.commitStateRestore(previousDiagnostic); } catch { /* Preserve original error. */ }
    try { engine.commitStateRestore(previousEngine); } catch { /* Preserve original error. */ }
    throw new StorageEngineError("RESTORE_FAILED", "Der Spielstand konnte nicht vollständig wiederhergestellt werden; der bisherige Zustand bleibt erhalten.", error);
  }
};
