const ROOM_STATES = new Set(["unbekannt", "entdeckt", "abgeschlossen", "verschlossen"]);
const CONNECTION_STATES = new Set(["verborgen", "sichtbar"]);
const clone = (value) => structuredClone(value);

export class MapState {
  constructor(mapDefinition) {
    this.definition = mapDefinition;
    this.listeners = new Set();
    this.reset();
  }

  reset() {
    this.state = {
      rooms: Object.fromEntries(this.definition.rooms.map((room) => [room.id, room.initialState])),
      connections: Object.fromEntries(this.definition.connections.map((connection) => [connection.id, connection.initialState])),
      currentRoom: this.definition.initialState?.currentRoom ?? null,
      mrLaserRoom: this.definition.initialState?.mrLaserRoom ?? null,
      revision: 0
    };
    this.notify();
  }

  getSnapshot() {
    return clone(this.state);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  discoverRoom(roomId) {
    if (!this.hasRoom(roomId)) return;
    if (this.state.rooms[roomId] === "unbekannt" || this.state.rooms[roomId] === "verschlossen") {
      this.state.rooms[roomId] = "entdeckt";
      this.revealConnectedPaths(roomId);
      this.changed();
    }
  }

  completeRoom(roomId) {
    if (!this.hasRoom(roomId) || this.state.rooms[roomId] === "abgeschlossen") return;
    this.state.rooms[roomId] = "abgeschlossen";
    this.revealConnectedPaths(roomId);
    this.changed();
  }

  lockRoom(roomId) {
    if (!this.hasRoom(roomId) || this.state.rooms[roomId] === "abgeschlossen") return;
    this.state.rooms[roomId] = "verschlossen";
    this.changed();
  }

  setCurrentRoom(roomId) {
    if (!this.hasRoom(roomId) || this.state.currentRoom === roomId) return;
    this.state.currentRoom = roomId;
    if (this.state.rooms[roomId] === "unbekannt" || this.state.rooms[roomId] === "verschlossen") {
      this.state.rooms[roomId] = "entdeckt";
      this.revealConnectedPaths(roomId);
    }
    this.changed();
  }

  setMrLaserRoom(roomId) {
    if (!this.hasRoom(roomId) || this.state.mrLaserRoom === roomId) return;
    this.state.mrLaserRoom = roomId;
    if (this.state.rooms[roomId] === "unbekannt" || this.state.rooms[roomId] === "verschlossen") {
      this.state.rooms[roomId] = "entdeckt";
      this.revealConnectedPaths(roomId);
    }
    this.changed();
  }

  revealConnection(connectionId) {
    if (!(connectionId in this.state.connections) || this.state.connections[connectionId] === "sichtbar") return;
    this.state.connections[connectionId] = "sichtbar";
    this.changed();
  }

  exportState() {
    const { revision, ...persistent } = this.state;
    return clone(persistent);
  }

  importState(candidate) {
    if (candidate == null) return this.reset();
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("Ungültiger Kartenfortschritt.");
    const roomIds = new Set(this.definition.rooms.map((room) => room.id));
    const connectionIds = new Set(this.definition.connections.map((connection) => connection.id));
    if (!candidate.rooms || !candidate.connections) throw new Error("Der Kartenfortschritt ist unvollständig.");
    for (const [id, state] of Object.entries(candidate.rooms)) {
      if (!roomIds.has(id) || !ROOM_STATES.has(state)) throw new Error("Der Kartenfortschritt enthält einen ungültigen Raum.");
    }
    for (const [id, state] of Object.entries(candidate.connections)) {
      if (!connectionIds.has(id) || !CONNECTION_STATES.has(state)) throw new Error("Der Kartenfortschritt enthält eine ungültige Verbindung.");
    }
    const defaults = {
      rooms: Object.fromEntries(this.definition.rooms.map((room) => [room.id, room.initialState])),
      connections: Object.fromEntries(this.definition.connections.map((connection) => [connection.id, connection.initialState])),
      currentRoom: this.definition.initialState?.currentRoom ?? null,
      mrLaserRoom: this.definition.initialState?.mrLaserRoom ?? null
    };
    this.state = {
      rooms: { ...defaults.rooms, ...candidate.rooms },
      connections: { ...defaults.connections, ...candidate.connections },
      currentRoom: roomIds.has(candidate.currentRoom) ? candidate.currentRoom : defaults.currentRoom,
      mrLaserRoom: roomIds.has(candidate.mrLaserRoom) ? candidate.mrLaserRoom : defaults.mrLaserRoom,
      revision: this.state.revision + 1
    };
    this.notify();
  }

  revealConnectedPaths(roomId) {
    this.definition.connections
      .filter((connection) => connection.from === roomId || connection.to === roomId)
      .forEach((connection) => { this.state.connections[connection.id] = "sichtbar"; });
  }

  hasRoom(roomId) {
    return Object.hasOwn(this.state.rooms, roomId);
  }

  changed() {
    this.state.revision += 1;
    this.notify();
  }

  notify() {
    this.listeners.forEach((listener) => listener(this.getSnapshot()));
  }
}
