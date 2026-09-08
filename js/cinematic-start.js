const BLOCKED_START_KEYS = new Set(["Escape", "Shift", "Control", "Alt", "Meta", "CapsLock", "Tab"]);

export const INTRO_SCENE_DURATION = 4000;
export const INTRO_FADE_DURATION = 500;
export const INTRO_SCENES = Object.freeze([
  { id: "arrival", label: "Schüler kommen an", asset: "assets/intro-arrival.png" },
  { id: "title", label: "THE MYSTERY OF GREENVILLE HIGH", asset: "assets/greenville-cinematic-start.png" },
  { id: "smartboard", label: "Stiller Flur vor dem Smartboard", asset: "assets/intro-smartboard.png" }
]);

export const isCinematicStartKey = (key) => (
  typeof key === "string" && !BLOCKED_START_KEYS.has(key) && !/^F(?:[1-9]|1\d|2[0-4])$/.test(key)
);

export const cinematicSceneMarkup = (scene, index, total) => `
  <section class="cinematic-start cinematic-start--scene cinematic-start--${scene.id}"
    style="background-image:url('${scene.asset}')"
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
    wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds)),
    now = Date.now,
    prepareImage = (asset) => {
      const image = new Image();
      image.src = asset;
      return image.decode().catch(() => {});
    }
  } = {}) {
    this.root = root;
    this.eventTarget = eventTarget;
    this.reducedMotion = reducedMotion;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.wait = wait;
    this.prepareImage = prepareImage;
    this.now = now;
    this.ignoreClicksUntil = 0;
    this.ignoreInputUntil = 0;
  }

  async play() {
    // Loading completion never chooses a scene or advances the sequence.
    const images = INTRO_SCENES.map((scene) => this.prepareImage(scene.asset));
    for (let index = 0; index < INTRO_SCENES.length; index += 1) {
      const scene = INTRO_SCENES[index];
      await images[index];
      this.root.innerHTML = cinematicSceneMarkup(scene, index, INTRO_SCENES.length);
      this.focusScreen();
      const action = await this.awaitAdvance(INTRO_SCENE_DURATION);
      if (action === "skip") { this.skipped = true; break; }
      if (index === INTRO_SCENES.length - 1) break;
      await images[index + 1];
      const stage = this.root.querySelector(".cinematic-start");
      stage.style.backgroundImage = `url('${INTRO_SCENES[index + 1].asset}')`;
      stage.classList.add("is-crossfading");
      await this.wait(this.reducedMotion ? 0 : INTRO_FADE_DURATION);
    }
  }

  holdForGame() {
    this.finalScene = this.root.querySelector(".cinematic-start");
    if (this.finalScene) this.root.ownerDocument.body.append(this.finalScene);
  }

  async revealGame() {
    if (!this.finalScene) return;
    if (!this.skipped) {
      // Commit the opaque, reparented stage before starting its CSS transition.
      void this.finalScene.offsetWidth;
      this.finalScene.classList.add("is-leaving");
      await this.wait(this.reducedMotion ? 0 : INTRO_FADE_DURATION);
    }
    this.finalScene.remove();
    this.finalScene = null;
  }

  focusScreen() {
    this.root.querySelector(".cinematic-start")?.focus({ preventScroll: true });
  }

  awaitAdvance(duration) {
    return new Promise((resolve) => {
      let timer = null;
      let finished = false;
      const finish = (action) => {
        if (finished) return;
        finished = true;
        // Also suppress the competing event at a timer/interaction boundary.
        this.ignoreInputUntil = this.now() + INTRO_FADE_DURATION;
        if (timer !== null) this.clearTimer(timer);
        this.eventTarget.removeEventListener("click", interact);
        this.eventTarget.removeEventListener("pointerup", interact);
        this.eventTarget.removeEventListener("keydown", interact);
        resolve(action);
      };
      const interact = (event) => {
        if (this.now() < this.ignoreInputUntil) return;
        if (event.target?.closest?.("[data-action='intro-skip']")) return finish("skip");
        if (event.type === "keydown" && (event.repeat || !isCinematicStartKey(event.key))) return;
        if (event.type === "pointerup") {
          if (event.pointerType === "mouse") return;
          this.ignoreClicksUntil = this.now() + 500;
        }
        if (event.type === "click" && this.now() < this.ignoreClicksUntil) return;
        finish("next");
      };
      this.eventTarget.addEventListener("click", interact);
      this.eventTarget.addEventListener("pointerup", interact);
      this.eventTarget.addEventListener("keydown", interact);
      if (duration !== null) timer = this.setTimer(() => finish("next"), duration);
    });
  }
}
