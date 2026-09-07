export class Room {
  constructor(definition) {
    if (!definition?.id || !definition?.geometry) throw new Error("Ein Kartenraum benötigt ID und Geometrie.");
    this.id = definition.id;
    this.name = definition.name ?? definition.id;
    this.shortName = definition.shortName ?? this.name;
    this.icon = definition.icon ?? "room";
    this.description = definition.description ?? "";
    this.geometry = { ...definition.geometry };
    this.initialState = definition.initialState ?? "unbekannt";
  }
}
