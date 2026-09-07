import { Room } from "./room.js";
import { Connection } from "./connection.js";
import { MapState } from "./map-state.js";
import { MapAnimations } from "./map-animations.js";
import { MapRenderer } from "./map-renderer.js";

export class SchoolMap {
  constructor(root, definition) {
    if (!root) throw new Error("Die Schulkarte benötigt ein Zielelement.");
    this.root = root;
    this.definition = {
      ...definition,
      rooms: definition.rooms.map((room) => new Room(room)),
      connections: definition.connections.map((connection) => new Connection(connection))
    };
    this.state = new MapState(this.definition);
    this.renderer = new MapRenderer(
      root,
      this.definition,
      this.definition.rooms,
      this.definition.connections,
      new MapAnimations(root)
    );
    this.unsubscribe = this.state.subscribe((snapshot) => this.renderer.render(snapshot));
    this.renderer.render(this.state.getSnapshot());
  }

  discoverRoom(roomId) { this.state.discoverRoom(roomId); }
  completeRoom(roomId) { this.state.completeRoom(roomId); }
  lockRoom(roomId) { this.state.lockRoom(roomId); }
  setCurrentRoom(roomId) { this.state.setCurrentRoom(roomId); }
  setMrLaserRoom(roomId) { this.state.setMrLaserRoom(roomId); }
  revealConnection(connectionId) { this.state.revealConnection(connectionId); }
  reset() { this.state.reset(); }
  exportState() { return this.state.exportState(); }
  importState(savedState) { this.state.importState(savedState); }
  destroy() { this.unsubscribe(); }
}
