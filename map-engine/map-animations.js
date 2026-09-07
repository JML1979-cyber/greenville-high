export class MapAnimations {
  constructor(root) {
    this.root = root;
  }

  markChanges(previous, current) {
    if (!previous) return;
    Object.entries(current.rooms).forEach(([roomId, state]) => {
      const room = this.root.querySelector(`[data-room-id="${CSS.escape(roomId)}"]`);
      if (!room || previous.rooms[roomId] === state) return;
      room.classList.add(state === "abgeschlossen" ? "is-just-completed" : "is-just-revealed");
    });
    Object.entries(current.connections).forEach(([connectionId, state]) => {
      if (state !== "sichtbar" || previous.connections[connectionId] === state) return;
      this.root.querySelector(`[data-connection-id="${CSS.escape(connectionId)}"]`)?.classList.add("is-just-revealed");
    });
  }
}
