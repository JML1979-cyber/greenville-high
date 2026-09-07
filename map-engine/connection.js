export class Connection {
  constructor(definition) {
    if (!definition?.id || !definition?.from || !definition?.to || !definition?.path) {
      throw new Error("Eine Kartenverbindung benötigt ID, Endpunkte und Pfad.");
    }
    Object.assign(this, definition);
    this.initialState = definition.initialState ?? "verborgen";
  }
}
