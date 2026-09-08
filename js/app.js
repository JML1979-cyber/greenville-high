import { Engine } from "./engine.js";
import { Router } from "./router.js";
import { bindUiEvents, createScreens } from "./ui.js";
import { CinematicStart } from "./cinematic-start.js";
import { DiagnosticEngine } from "./diagnostic-engine.js";
import { EvaluationEngine } from "./evaluation-engine.js";
import { ReviewEngine } from "./review-engine.js";
import { RoutingEngine } from "./routing-engine.js";
import { StorageEngine, restorePlayerStateAtomically } from "./storage-engine.js";
import { SchoolMap } from "../map-engine/school-map.js";
import { EntryPathAssigner } from "./entry-path-assigner.js";
import { FollowUpEngine } from "./follow-up-engine.js";
import { MapPhaseController } from "./map-phase-controller.js";
import { ElectroLabSession } from "./electro-lab-session.js";
import { ChemistryLabSession } from "./chemistry-lab-session.js";

const MISSION_ID = "greenville-physics-diagnostic-2026-v3";

const root = document.querySelector("#app");

async function loadData() {
  const files = [
    "questions", "support-questions", "extended-questions",
    "chemistry-support-questions", "chemistry-extended-questions",
    "rooms", "player", "school-map"
  ];
  const entries = await Promise.all(files.map(async (file) => {
    const response = await fetch(`data/${file}.json`);
    if (!response.ok) throw new Error(`Datei data/${file}.json konnte nicht geladen werden.`);
    return [file, await response.json()];
  }));
  return Object.fromEntries(entries);
}

const intro = new CinematicStart(root);
try {
  await intro.play();
  const data = await loadData();
  intro.holdForGame();
  root.innerHTML = `
    <section id="school-map" class="school-map" aria-label="Greenville-Schulkarte"></section>
    <section id="screen-root" class="screen-root" aria-live="polite"></section>`;
  const screenRoot = root.querySelector("#screen-root");
  const schoolMap = new SchoolMap(root.querySelector("#school-map"), data["school-map"]);
  const mapPhase = new MapPhaseController(schoolMap);
  const engine = new Engine(data.player);
  // The diagnostic module owns task metadata; the game engine receives only
  // snapshots, keeping both components independently replaceable.
  const diagnostics = new DiagnosticEngine(data.questions);
  const evaluation = new EvaluationEngine();
  const review = new ReviewEngine();
  const routing = new RoutingEngine();
  const entryPathAssigner = new EntryPathAssigner(data.questions.map((question) => question.id));
  const followUp = new FollowUpEngine({
    support: data["support-questions"].slice(0, 7),
    extended: data["extended-questions"].slice(0, 7)
  });
  const electroLab = new ElectroLabSession({
    support: data["support-questions"].slice(7),
    extended: data["extended-questions"].slice(7)
  });
  const chemistryLab = new ChemistryLabSession({
    support: data["chemistry-support-questions"],
    extended: data["chemistry-extended-questions"]
  });
  const storage = new StorageEngine({
    missionId: MISSION_ID,
    taskIds: data.questions.map((question) => question.id),
    entryPathAssigner,
    pathTaskIds: {
      support: data["support-questions"].slice(0, 7).map((question) => question.id),
      extended: data["extended-questions"].slice(0, 7).map((question) => question.id)
    }
  });
  diagnostics.subscribe((snapshot) => engine.setDiagnosticState(snapshot));
  engine.setDiagnosticState(diagnostics.getSnapshot());
  const router = new Router(engine, (markup) => { screenRoot.innerHTML = markup; });
  const screens = createScreens(data, engine, diagnostics, followUp, electroLab, chemistryLab);
  Object.entries(screens).forEach(([name, screen]) => router.register(name, screen));
  const persistence = {
    save: () => storage.savePlayerState(
      { engine: engine.getState(), diagnostic: diagnostics.exportState(), followUp: followUp.exportState() },
      { schoolMap: schoolMap.exportState() }
    ),
    load: () => {
      const envelope = storage.loadPlayerState();
      if (envelope) {
        restorePlayerStateAtomically(envelope.state, { engine, diagnostics, followUp });
        mapPhase.restoreForScreen(engine.getState().currentScreen, envelope.extensions.schoolMap ?? null);
        mapPhase.restoreFollowUpProgress(followUp.exportState().currentIndex, {
          enterNextStep: engine.getState().currentScreen !== "mechanics-find"
        });
        mapPhase.restoreStoryProgress(engine.getState().currentScreen);
      }
      return envelope;
    },
    clear: () => storage.clearPlayerState(),
    export: () => storage.exportPlayerState(),
    import: (serialized) => {
      const envelope = storage.importPlayerState(serialized);
      restorePlayerStateAtomically(envelope.state, { engine, diagnostics, followUp });
      mapPhase.restoreForScreen(engine.getState().currentScreen, envelope.extensions.schoolMap ?? null);
      mapPhase.restoreFollowUpProgress(followUp.exportState().currentIndex, {
        enterNextStep: engine.getState().currentScreen !== "mechanics-find"
      });
      mapPhase.restoreStoryProgress(engine.getState().currentScreen);
      return envelope;
    }
  };
  bindUiEvents(screenRoot, router, engine, diagnostics, evaluation, review, routing, entryPathAssigner, followUp, data.questions, persistence, mapPhase, electroLab, chemistryLab);
  engine.subscribe((state) => {
    mapPhase.handleScreen(state.currentScreen);
    if (state.entryPathAssignment) {
      followUp.activate(state.entryPathAssignment);
      electroLab.activate(state.entryPathAssignment.path);
      chemistryLab.activate(state.entryPathAssignment.path);
    }
  });

  try {
    const restored = persistence.load();
    if (restored) {
      router.go(engine.getState().currentScreen);
    } else {
      router.go("mr-laser");
    }
  } catch (storageError) {
    console.error(storageError);
    router.go("settings");
    const feedback = screenRoot.querySelector("#storage-feedback");
    if (feedback) feedback.textContent = storageError.message;
  }
  await intro.revealGame();
} catch (error) {
  root.innerHTML = `<section class="screen-panel error-panel"><p class="eyebrow">Greenville High School</p><h1>Die Erkundung kann gerade nicht beginnen</h1><p>${error.message}</p><p>Bitte öffne die Anwendung über den vorgesehenen lokalen Start.</p></section>`;
  console.error(error);
  await intro.revealGame();
}
