import { getPhaseTwoRouteStep } from "./phase-two-route.js";

const ENTRY_PHASE_SCREENS = new Set([
  "start", "settings", "about", "welcome", "diagnostics", "briefing", "mr-laser", "questions",
  "entry-transition", "mechanics-transition", "evaluation", "entry-feedback", "entry-ready"
]);

const FOLLOW_UP_PHASE_SCREENS = new Set([
  "follow-up-questions", "mechanics-find", "energy-cliffhanger", "follow-up-complete",
  "electro-transition", "electro-questions", "electro-complete",
  "chemistry-transition", "chemistry-questions", "chemistry-complete",
  "repair-area", "research-area", "end"
]);

const ELECTRO_SCREENS = new Set(["electro-transition", "electro-questions", "electro-complete"]);
const CHEMISTRY_SCREENS = new Set(["chemistry-transition", "chemistry-questions", "chemistry-complete"]);

/**
 * Keeps story navigation separate from map progression. Entry assessment
 * screens always use the pristine corridor state. Follow-up movement must be
 * triggered explicitly through enterRoom()/completeRoom() by future story
 * events; task metadata alone never mutates the map.
 */
export class MapPhaseController {
  constructor(schoolMap) {
    this.schoolMap = schoolMap;
    this.phase = null;
  }

  handleScreen(screen) {
    if (ENTRY_PHASE_SCREENS.has(screen)) {
      if (this.phase !== "entry") this.schoolMap.reset();
      this.phase = "entry";
    } else if (FOLLOW_UP_PHASE_SCREENS.has(screen)) {
      this.phase = "follow-up";
      this.restoreStoryProgress(screen);
    }
  }

  restoreForScreen(screen, savedState) {
    this.schoolMap.importState(savedState ?? null);
    if (ENTRY_PHASE_SCREENS.has(screen)) {
      this.schoolMap.reset();
      this.phase = "entry";
    } else if (FOLLOW_UP_PHASE_SCREENS.has(screen)) {
      this.phase = "follow-up";
      this.restoreStoryProgress(screen);
    }
  }

  enterRoom(roomId, { moveMrLaser = false } = {}) {
    if (this.phase !== "follow-up") return false;
    this.schoolMap.setCurrentRoom(roomId);
    if (moveMrLaser) this.schoolMap.setMrLaserRoom(roomId);
    return true;
  }

  completeRoom(roomId) {
    if (this.phase !== "follow-up") return false;
    this.schoolMap.completeRoom(roomId);
    return true;
  }

  revealConnection(connectionId) {
    if (this.phase !== "follow-up") return false;
    this.schoolMap.revealConnection(connectionId);
    return true;
  }

  enterFollowUpStep(order) {
    const step = getPhaseTwoRouteStep(order);
    if (!step) return false;
    return this.enterRoom(step.roomId, { moveMrLaser: true });
  }

  completeFollowUpStep(order) {
    const step = getPhaseTwoRouteStep(order);
    if (!step || this.phase !== "follow-up") return false;
    if (step.completeRoomId) this.completeRoom(step.completeRoomId);
    if (step.revealConnectionId) this.revealConnection(step.revealConnectionId);
    return true;
  }

  restoreFollowUpProgress(completedTaskCount, { enterNextStep = true } = {}) {
    if (this.phase !== "follow-up" || !Number.isInteger(completedTaskCount)
      || completedTaskCount < 0 || completedTaskCount > 7) return false;
    for (let order = 1; order <= completedTaskCount; order += 1) this.completeFollowUpStep(order);
    const activeOrder = enterNextStep ? completedTaskCount + 1 : Math.max(completedTaskCount, 1);
    this.enterFollowUpStep(Math.min(activeOrder, 7));
    return true;
  }

  enterElectroLab() {
    if (this.phase !== "follow-up") return false;
    this.completeRoom("energielabor");
    return this.enterRoom("unknown-a02", { moveMrLaser: true });
  }

  completeElectroLab() {
    return this.completeRoom("unknown-a02");
  }

  enterChemistryLab() {
    if (this.phase !== "follow-up") return false;
    this.completeElectroLab();
    return this.enterRoom("unknown-a03", { moveMrLaser: true });
  }

  completeChemistryLab() {
    return this.completeRoom("unknown-a03");
  }

  restoreStoryProgress(screen) {
    if (this.phase !== "follow-up") return false;
    if (CHEMISTRY_SCREENS.has(screen)) {
      this.enterChemistryLab();
      if (screen === "chemistry-complete") this.completeChemistryLab();
      return true;
    }
    if (ELECTRO_SCREENS.has(screen)) {
      this.enterElectroLab();
      if (screen === "electro-complete") this.completeElectroLab();
      return true;
    }
    return false;
  }
}
