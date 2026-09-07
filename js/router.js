/** Screen registry and tiny hash router. New screens only need a renderer entry. */
export class Router {
  constructor(engine, render) {
    this.engine = engine;
    this.render = render;
    this.routes = new Map();
    this.skipNextHashChange = false;
    window.addEventListener("hashchange", () => {
      if (this.skipNextHashChange) {
        this.skipNextHashChange = false;
        return;
      }
      this.resolve();
    });
  }

  register(name, renderer) {
    this.routes.set(name, renderer);
  }

  start() {
    this.resolve();
  }

  go(name) {
    const target = this.routes.has(name) ? name : "start";
    if (location.hash === `#/${target}`) {
      this.resolve(target);
      return;
    }

    // Render immediately so a component can safely start after go() returns;
    // suppress the matching browser hash event to avoid a second render.
    this.skipNextHashChange = true;
    location.hash = `/${target}`;
    this.resolve(target);
  }

  resolve(requestedRoute = null) {
    const requested = requestedRoute || location.hash.replace(/^#\//, "") || "start";
    const name = this.routes.has(requested) ? requested : "start";
    const screen = this.routes.get(name);
    this.engine.setScreen(name);
    this.render(screen(this.engine.getState()));
  }
}
