const BLOCKED_START_KEYS = new Set(["Escape", "Shift", "Control", "Alt", "Meta", "CapsLock", "Tab"]);

export const INTRO_SCENE_DURATION = 4000;
export const INTRO_FADE_DURATION = 500;
export const INTRO_SCENES = Object.freeze([
  { id: "arrival", label: "Schüler kommen an", asset: "assets/intro-arrival.png" },
  { id: "slogan", label: "THINK. EXPLORE. CHANGE.", asset: "assets/greenville-cinematic-start.png" },
  { id: "title", label: "THE MYSTERY OF GREENVILLE HIGH", asset: "assets/greenville-cinematic-start.png" },
  { id: "smartboard", label: "Stiller Flur vor dem Smartboard", asset: "assets/intro-smartboard.png" }
]);

export const isCinematicStartKey = (key) => (
  typeof key === "string" && !BLOCKED_START_KEYS.has(key) && !/^F(?:[1-9]|1\d|2[0-4])$/.test(key)
);

export const cinematicStartMarkup = () => `
  <section class="cinematic-start cinematic-start--gate" tabindex="0" role="button"
    aria-label="The Mystery of Greenville High. Klicke oder drücke eine Taste, um zu beginnen.">
    <img class="cinematic-start__image" src="assets/greenville-cinematic-start.png" alt="" />
    <div class="visually-hidden">
      <p>THE MYSTERY OF</p><h1>GREENVILLE HIGH</h1>
      <p>THINK. EXPLORE. CHANGE.</p>
      <p>Klicke oder drücke eine Taste, um zu beginnen</p>
    </div>
  </section>`;

export const cinematicSceneMarkup = (scene, index, total) => `
  <section class="cinematic-start cinematic-start--scene cinematic-start--${scene.id}"
    tabindex="0" aria-label="Intro-Szene ${index + 1} von ${total}: ${scene.label}">
    <img class="cinematic-start__image" src="${scene.asset}" alt="" />
    <p class="visually-hidden">${scene.label}</p>
    <button class="cinematic-start__skip" type="button" data-action="intro-skip">Intro überspringen</button>
  </section>`;

/** Presentation-only sequence. It owns no game state and resolves once per page load. */
export class CinematicStart {
  constructor(root, {
    eventTarget = window,
    reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    setTimer = window.setTimeout.bind(window),
    clearTimer = window.clearTimeout.bind(window),
    wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))
  } = {}) {
    this.root = root;
    this.eventTarget = eventTarget;
    this.reducedMotion = reducedMotion;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.wait = wait;
    this.ignoreClicksUntil = 0;
  }

  async play() {
    this.root.innerHTML = cinematicStartMarkup();
    this.focusScreen();
    await this.awaitAdvance(null, { gate: true });

    for (let index = 0; index < INTRO_SCENES.length; index += 1) {
      const scene = INTRO_SCENES[index];
      this.root.innerHTML = cinematicSceneMarkup(scene, index, INTRO_SCENES.length);
      this.focusScreen();
      const action = await this.awaitAdvance(INTRO_SCENE_DURATION);
      if (action === "skip") break;
      this.root.querySelector(".cinematic-start")?.classList.add("is-leaving");
      await this.wait(this.reducedMotion ? 0 : INTRO_FADE_DURATION);
    }
  }

  focusScreen() {
    this.root.querySelector(".cinematic-start")?.focus({ preventScroll: true });
  }

  awaitAdvance(duration, { gate = false } = {}) {
    return new Promise((resolve) => {
      let timer = null;
      const finish = (action) => {
        if (timer !== null) this.clearTimer(timer);
        this.eventTarget.removeEventListener("click", interact);
        this.eventTarget.removeEventListener("pointerup", interact);
        this.eventTarget.removeEventListener("keydown", interact);
        resolve(action);
      };
      const interact = (event) => {
        if (event.target?.closest?.("[data-action='intro-skip']")) return finish("skip");
        if (event.type === "keydown" && !isCinematicStartKey(event.key)) return;
        if (event.type === "pointerup") {
          if (event.pointerType === "mouse") return;
          this.ignoreClicksUntil = Date.now() + 500;
        }
        if (event.type === "click" && Date.now() < this.ignoreClicksUntil) return;
        finish(gate ? "start" : "next");
      };
      this.eventTarget.addEventListener("click", interact);
      this.eventTarget.addEventListener("pointerup", interact);
      this.eventTarget.addEventListener("keydown", interact);
      if (duration !== null) timer = this.setTimer(() => finish("next"), duration);
    });
  }
}
