const escapeHtml = (value = "") => String(value).replace(/[&<>\"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
}[character]));

const iconMarkup = (icon) => ({
  laser: '<circle cx="0" cy="0" r="8"></circle><path d="M 10 0 H 28 M 19 -7 L 28 0 L 19 7"></path>',
  route: '<path d="M -22 10 H -5 L 5 -10 H 22"></path><circle cx="-22" cy="10" r="4"></circle><circle cx="22" cy="-10" r="4"></circle>',
  energy: '<path d="M 5 -25 L -13 3 H 1 L -5 25 L 18 -7 H 4 Z"></path>',
  optics: '<path d="M -26 0 Q 0 -25 26 0 Q 0 25 -26 0 Z"></path><circle cx="0" cy="0" r="8"></circle>',
  room: '<rect x="-14" y="-14" width="28" height="28"></rect>'
}[icon] ?? '<rect x="-14" y="-14" width="28" height="28"></rect>');

const markerMarkup = (type) => ({
  player: '<circle class="map-marker__halo" r="16"></circle><circle class="map-marker__disc" r="11"></circle><path class="map-marker__person" d="M -4 6 V 1 A 4 4 0 1 1 4 1 V 6"></path><path class="map-marker__pointer" d="M 0 17 L -4 10 H 4 Z"></path>',
  laser: '<circle class="map-marker__halo" r="20"></circle><circle class="map-marker__medallion" r="17"></circle><path class="map-marker__shirt" d="M -11 14 C -10 6 -6 3 0 3 C 6 3 10 6 11 14 Z"></path><path class="map-marker__collar" d="M -5 4 L 0 10 L 5 4"></path><path class="map-marker__tie" d="M 0 10 L -2 15 H 2 Z"></path><circle class="map-marker__head" cx="0" cy="-5" r="7"></circle><path class="map-marker__hair" d="M -7 -5 C -7 -13 7 -14 8 -5 L 5 -8 L 1 -10 L -3 -8 L -6 -5 Z"></path><path class="map-marker__glasses" d="M -7 -6 H -2 M 2 -6 H 7 M -2 -6 H 2 M -7 -6 V -3 H -2 V -6 M 2 -6 V -3 H 7 V -6"></path><path class="map-marker__smile" d="M -2 0 Q 0 2 2 0"></path>'
}[type] ?? "");

const statusSymbolMarkup = (status) => ({
  abgeschlossen: '<g class="map-room__check"><circle r="10"></circle><path d="M -5 0 L -1 4 L 6 -5"></path></g>',
  verschlossen: '<g class="map-room__lock"><rect x="-8" y="-1" width="16" height="12" rx="2"></rect><path d="M -5 -1 V -6 A 5 5 0 0 1 5 -6 V -1"></path></g>',
  unbekannt: '<text class="map-room__unknown" x="0" y="5" text-anchor="middle">?</text>'
}[status] ?? "");

const VISUAL_ROOM_ANCHORS = Object.freeze({
  "laser-labor": { labelX: 239, labelY: 347, labelWidth: 170, markerX: 155, markerY: 400 },
  "unknown-a01": { labelX: 475, labelY: 347, labelWidth: 190, markerX: 405, markerY: 400 },
  energielabor: { labelX: 700, labelY: 347, labelWidth: 175, markerX: 630, markerY: 400 },
  "unknown-a02": { labelX: 920, labelY: 347, labelWidth: 170, markerX: 855, markerY: 400 },
  "unknown-a03": { labelX: 1131, labelY: 347, labelWidth: 160, markerX: 1070, markerY: 400 },
  transferkorridor: { labelX: 660, labelY: 511, labelWidth: 100, markerX: 155, markerY: 530 },
  optiklabor: { labelX: 779, labelY: 684, labelWidth: 150, markerX: 710, markerY: 790 }
});

const roomFixturesMarkup = (room) => {
  const { x, y, width, height } = room.geometry;
  const fixtureY = y + 27;
  const benchWidth = Math.min(width - 54, 92);
  const benchX = x + width - benchWidth - 24;
  const apparatus = room.icon === "laser"
    ? `<circle cx="${benchX + 18}" cy="${fixtureY + 9}" r="5"></circle><path d="M ${benchX + 27} ${fixtureY + 9} H ${benchX + benchWidth - 10}"></path>`
    : room.icon === "energy"
      ? `<path d="M ${benchX + 15} ${fixtureY + 13} H ${benchX + 30} V ${fixtureY + 5} H ${benchX + 48}"></path><circle cx="${benchX + benchWidth - 14}" cy="${fixtureY + 13}" r="4"></circle>`
      : room.icon === "optics"
        ? `<path d="M ${benchX + 12} ${fixtureY + 13} H ${benchX + benchWidth - 14}"></path><path d="M ${benchX + 33} ${fixtureY + 5} V ${fixtureY + 20}"></path>`
        : `<path d="M ${benchX + 14} ${fixtureY + 13} H ${benchX + benchWidth - 14}"></path><circle cx="${benchX + 29}" cy="${fixtureY + 13}" r="4"></circle>`;
  return `<g class="map-room__fixtures" aria-hidden="true"><rect x="${benchX}" y="${fixtureY}" width="${benchWidth}" height="22" rx="2"></rect>${apparatus}</g>`;
};

const blueprintDecorationMarkup = () => `
  <g class="map-blueprint__dimensions" aria-hidden="true">
    <path d="M 50 37 H 1150 M 50 31 V 43 M 325 33 V 41 M 500 33 V 41 M 780 33 V 41 M 1150 31 V 43"></path>
    <text x="175" y="31" text-anchor="middle">WESTFLÜGEL</text><text x="640" y="31" text-anchor="middle">HAUPTTRAKT</text><text x="965" y="31" text-anchor="middle">OSTFLÜGEL</text>
    <path d="M 39 45 V 555 M 33 45 H 45 M 33 230 H 45 M 33 335 H 45 M 33 555 H 45"></path>
  </g>
  <g class="map-blueprint__windows" aria-hidden="true">
    <path d="M 83 45 H 116 M 139 45 H 172 M 507 45 H 540 M 563 45 H 596 M 1015 45 H 1048 M 1071 45 H 1104"></path>
    <path d="M 80 555 H 113 M 136 555 H 169 M 286 555 H 319 M 342 555 H 375 M 875 555 H 908 M 931 555 H 964"></path>
    <path d="M 50 82 V 115 M 50 138 V 171 M 1150 82 V 115 M 1150 138 V 171 M 1150 375 V 408 M 1150 431 V 464"></path>
  </g>
  `;

const blueprintHeaderMarkup = () => `
  <g class="blueprint-header" aria-hidden="true">
    <path class="blueprint-header__rule" d="M 42 118 H 1158 M 42 123 H 220 M 980 123 H 1158"></path>
    <g class="blueprint-header__crest" transform="translate(78 68)">
      <path d="M 0 -35 L 30 -24 V 7 C 30 26 18 38 0 46 C -18 38 -30 26 -30 7 V -24 Z"></path>
      <path d="M -18 -13 H 18 M -18 19 H 18 M -15 -19 V 15 M 15 -19 V 15 M -6 -2 H 6 M 0 -8 V 4"></path>
      <text x="0" y="33" text-anchor="middle">GHS</text>
    </g>
    <text class="blueprint-header__title" x="128" y="58">GREENVILLE HIGH SCHOOL</text>
    <text class="blueprint-header__subtitle" x="130" y="83">GREENVILLE CAMPUS · ERDGESCHOSS</text>
    <text class="blueprint-header__index" x="130" y="104">ARCHITEKTURPLAN / ERINNERUNGSARCHIV</text>
    <g class="blueprint-header__building" transform="translate(696 35)">
      <path d="M 4 65 H 236 M 16 65 V 32 H 62 V 65 M 70 65 V 10 H 142 V 65 M 150 65 V 25 H 222 V 65"></path>
      <path d="M 27 42 H 51 M 81 25 H 131 M 81 37 H 131 M 81 49 H 131 M 161 37 H 211"></path>
      <path d="M 0 73 H 240 M 10 69 V 77 M 120 69 V 77 M 230 69 V 77"></path>
      <text x="120" y="89" text-anchor="middle">CAMPUS-SILHOUETTE / SEKTOR A</text>
    </g>
    <g class="blueprint-header__stamp" transform="translate(970 32)">
      <rect width="188" height="72"></rect><path d="M 0 24 H 188 M 0 48 H 188 M 122 0 V 72"></path>
      <text x="10" y="16">ERINNERUNGSARCHIV</text><text x="10" y="40">PLAN 01 · EG</text><text x="10" y="64">GREENVILLE / A-01</text>
      <text x="178" y="16" text-anchor="end">REV</text><text x="178" y="40" text-anchor="end">01</text><text x="178" y="64" text-anchor="end">2026</text>
    </g>
  </g>`;

const blueprintReferenceHeaderMarkup = () => `
  <g class="blueprint-header blueprint-header--reference" aria-hidden="true">
    <path class="blueprint-header__rule" d="M 32 154 H 1408 M 32 160 H 218 M 1202 160 H 1408"></path>
    <g class="blueprint-header__crest" transform="translate(92 88)">
      <path d="M 0 -49 L 43 -33 V 10 C 43 38 27 55 0 67 C -27 55 -43 38 -43 10 V -33 Z"></path>
      <path d="M -29 -23 H 29 M -29 25 H 29 M -25 -31 V 21 M 25 -31 V 21"></path>
      <path d="M -15 -12 H -3 V 1 H -15 Z M 4 -15 C 13 -23 24 -15 18 -5 C 12 3 1 -4 4 -15 Z M -11 10 C -4 22 5 24 13 11"></path>
      <text x="0" y="47" text-anchor="middle">GHS</text><text class="blueprint-header__motto" x="0" y="82" text-anchor="middle">SCIENTIA EST LUX</text>
    </g>
    <text class="blueprint-header__title" x="172" y="75">GREENVILLE HIGH SCHOOL</text>
    <text class="blueprint-header__subtitle" x="174" y="111">GREENVILLE CAMPUS · ERDGESCHOSS</text>
    <text class="blueprint-header__index" x="174" y="137">ARCHIVPLAN / NATURWISSENSCHAFTLICHER TRAKT</text>
    <g class="blueprint-header__building" transform="translate(790 34)">
      <path d="M 4 94 H 334 M 18 94 V 45 H 77 V 94 M 84 94 V 21 H 154 V 94 M 160 94 V 8 H 224 V 94 M 231 94 V 38 H 320 V 94"></path>
      <path d="M 101 21 L 119 5 L 137 21 M 171 8 L 192 -8 L 213 8 M 247 38 L 275 19 L 303 38"></path>
      <path d="M 29 56 H 66 M 98 38 H 141 M 98 52 H 141 M 98 66 H 141 M 174 31 H 211 M 174 47 H 211 M 174 63 H 211 M 243 52 H 308"></path>
      <path d="M 0 103 H 340 M 13 99 V 107 M 170 99 V 107 M 327 99 V 107"></path>
      <text x="170" y="123" text-anchor="middle">GREENVILLE CAMPUS / FASSADENAUFRISS</text>
    </g>
    <g class="blueprint-header__stamp" transform="translate(1187 37)">
      <rect width="221" height="103"></rect><path d="M 0 34 H 221 M 0 68 H 221 M 143 0 V 103"></path>
      <text x="15" y="23">ERINNERUNGSARCHIV</text><text x="15" y="56">KARTEN-ID: GH-ER-00</text><text x="15" y="89">DATUM: 12.05.2025</text>
      <text x="208" y="23" text-anchor="end">REV</text><text x="208" y="56" text-anchor="end">01</text><text x="208" y="89" text-anchor="end">EG</text>
    </g>
  </g>`;

const blueprintLegendMarkup = () => `
  <g class="blueprint-legend" transform="translate(42 734)" aria-label="Kartenlegende">
    <rect class="blueprint-legend__frame" width="1116" height="50"></rect>
    <text class="blueprint-legend__title" x="14" y="20">LEGENDE</text><text class="blueprint-legend__note" x="14" y="37">STATUS / ORIENTIERUNG</text>
    <g class="blueprint-legend__item" transform="translate(155 25)"><g class="legend-marker map-marker map-marker--player">${markerMarkup("player")}</g><text x="25" y="5">DU BIST HIER</text></g>
    <g class="blueprint-legend__item" transform="translate(350 25)"><g class="legend-marker map-marker map-marker--laser" transform="scale(.72)">${markerMarkup("laser")}</g><text x="25" y="5">MR. LASER</text></g>
    <g class="blueprint-legend__item" transform="translate(522 25)"><rect class="legend-status map-room map-room--entdeckt" x="-12" y="-10" width="24" height="20"></rect><text x="23" y="5">ENTDECKT</text></g>
    <g class="blueprint-legend__item" transform="translate(682 25)"><g class="legend-status map-room map-room--abgeschlossen">${statusSymbolMarkup("abgeschlossen")}</g><text x="23" y="5">ABGESCHLOSSEN</text></g>
    <g class="blueprint-legend__item" transform="translate(880 25)"><g class="legend-status map-room map-room--verschlossen">${statusSymbolMarkup("verschlossen")}</g><text x="23" y="5">VERSCHLOSSEN</text></g>
    <g class="blueprint-legend__item" transform="translate(1050 25)"><g class="legend-status map-room map-room--unbekannt"><text class="map-room__unknown" x="0" y="7" text-anchor="middle">???</text></g><text x="22" y="5">UNBEKANNT</text></g>
  </g>`;

const blueprintReferenceLegendMarkup = () => `
  <g class="blueprint-legend blueprint-legend--reference" transform="translate(34 846)" aria-label="Kartenlegende">
    <rect class="blueprint-legend__frame" width="1372" height="80"></rect><path class="blueprint-legend__divider" d="M 0 31 H 1372 M 192 14 V 68 M 416 14 V 68 M 644 14 V 68 M 870 14 V 68 M 1114 14 V 68"></path>
    <text class="blueprint-legend__title" x="16" y="24">LEGENDE</text>
    <g class="blueprint-legend__item" transform="translate(44 50)"><g class="legend-marker map-marker map-marker--player">${markerMarkup("player")}</g><text x="31" y="-4">DU BIST HIER</text><text class="blueprint-legend__description" x="31" y="15">Deine Position</text></g>
    <g class="blueprint-legend__item" transform="translate(224 50)"><g class="legend-marker map-marker map-marker--laser" transform="scale(.8)">${markerMarkup("laser")}</g><text x="32" y="-4">MR. LASER</text><text class="blueprint-legend__description" x="32" y="15">Er begleitet dich</text></g>
    <g class="blueprint-legend__item" transform="translate(447 50)"><rect class="legend-status map-room map-room--entdeckt" x="-14" y="-14" width="28" height="28"></rect><text x="28" y="-4">ENTDECKT</text><text class="blueprint-legend__description" x="28" y="15">Du kennst diesen Raum</text></g>
    <g class="blueprint-legend__item" transform="translate(674 50)"><g class="legend-status map-room map-room--abgeschlossen">${statusSymbolMarkup("abgeschlossen")}</g><text x="28" y="-4">ABGESCHLOSSEN</text><text class="blueprint-legend__description" x="28" y="15">Aufgabe gelöst</text></g>
    <g class="blueprint-legend__item" transform="translate(900 50)"><g class="legend-status map-room map-room--verschlossen">${statusSymbolMarkup("verschlossen")}</g><text x="28" y="-4">VERSCHLOSSEN</text><text class="blueprint-legend__description" x="28" y="15">Noch nicht zugänglich</text></g>
    <g class="blueprint-legend__item" transform="translate(1144 50)"><g class="legend-status map-room map-room--unbekannt"><text class="map-room__unknown" x="0" y="7" text-anchor="middle">???</text></g><text x="34" y="-4">UNBEKANNT</text><text class="blueprint-legend__description" x="34" y="15">Noch nicht entdeckt</text></g>
  </g>`;

const blueprintReferenceAnnotationsMarkup = () => `
  <g class="blueprint-annotations" aria-hidden="true">
    <g class="blueprint-annotations__scale"><path d="M 48 194 V 782 M 42 194 H 54 M 42 390 H 54 M 42 586 H 54 M 42 782 H 54"></path><text x="57" y="204">10m</text><text x="57" y="400">20m</text><text x="57" y="596">30m</text></g>
    <g class="blueprint-annotations__science" transform="translate(1352 250)"><path d="M 0 0 V 92 M -20 18 H 20 M -14 36 H 14 M -9 58 H 9 M -15 92 H 15 M -10 92 V 108 M 10 92 V 108"></path><circle cy="-10" r="10"></circle><path d="M -35 130 C -14 100 14 100 35 130 M -18 142 H 18 M -26 153 H 26"></path></g>
    <g class="blueprint-annotations__compass blueprint-orientation" transform="translate(1346 682)"><circle r="45"></circle><circle r="32"></circle><path d="M 0 -58 V 58 M -58 0 H 58 M 0 -39 L 9 0 L 0 39 L -9 0 Z"></path><text x="0" y="-65" text-anchor="middle">N</text></g>
    <path class="blueprint-annotations__corner" d="M 24 830 H 58 V 836 M 1416 830 H 1382 V 836"></path>
  </g>`;

export class MapRenderer {
  constructor(root, definition, rooms, connections, animations) {
    this.root = root;
    this.definition = definition;
    this.rooms = rooms;
    this.connections = connections;
    this.animations = animations;
    this.previous = null;
  }

  render(state) {
    this.root.innerHTML = `
      <svg class="school-map__drawing school-map__reference-sheet" viewBox="0 0 1398 1125" role="img" aria-labelledby="school-map-title school-map-description">
          <title id="school-map-title">Interaktive Karte der Greenville High School</title>
          <image class="school-map__reference-image" href="assets/greenville-map-reference.png" width="1398" height="1125" preserveAspectRatio="xMidYMid meet"></image>
          <g class="school-map__dynamic-layer school-map__dynamic-layer--status-only">
            <g class="school-map__room-statuses">${this.rooms.map((room) => this.renderRoom(room, state)).join("")}</g>
          </g>
           <desc id="school-map-description">Statische Blueprint-Karte der Greenville High School mit dynamischen Status- und Positionsmarkern.</desc>
      </svg>`;
    this.animations.markChanges(this.previous, state);
    this.previous = structuredClone(state);
  }

  renderRoom(room, state) {
    const status = state.rooms[room.id];
    const known = status === "entdeckt" || status === "abgeschlossen";
    const anchor = VISUAL_ROOM_ANCHORS[room.id];
    if (!anchor) return "";
    const classes = ["map-room", `map-room--${status}`];
    if (room.icon === "route") classes.push("map-room--corridor");
    if (state.currentRoom === room.id) classes.push("map-room--current");
    if (state.mrLaserRoom === room.id) classes.push("map-room--mr-laser");
    const accessibleName = known ? room.name : status === "verschlossen" ? "Verschlossener, unbekannter Raum" : "Unbekannter Raum";
    return `<g class="${classes.join(" ")}" data-room-id="${escapeHtml(room.id)}" tabindex="0" role="group" aria-label="${escapeHtml(accessibleName)}">
      ${!known ? `<g class="map-room__status-plaque" transform="translate(${anchor.labelX} ${anchor.labelY})"><rect x="${-anchor.labelWidth / 2}" y="-28" width="${anchor.labelWidth}" height="46" rx="4"></rect><text class="map-room__unknown" x="0" y="4" text-anchor="middle">???</text></g>` : ""}
      ${status === "verschlossen" ? `<g class="map-room__lock" transform="translate(${anchor.labelX} ${anchor.labelY + 38})"><rect x="-9" y="-2" width="18" height="14" rx="2"></rect><path d="M -6 -2 V -8 A 6 6 0 0 1 6 -8 V -2"></path></g>` : ""}
      ${status === "abgeschlossen" ? `<g class="map-room__check" transform="translate(${anchor.labelX} ${anchor.labelY + 42})"><circle r="13"></circle><path d="M -6 0 L -1 5 L 7 -6"></path></g>` : ""}
      ${state.currentRoom === room.id ? `<g class="map-marker map-marker--player" transform="translate(${anchor.markerX} ${anchor.markerY})" role="img" aria-label="Spieler">${markerMarkup("player")}</g>` : ""}
      ${state.mrLaserRoom === room.id ? `<g class="map-marker map-marker--laser" transform="translate(${anchor.markerX + 46} ${anchor.markerY})" role="img" aria-label="Mr. Laser">${markerMarkup("laser")}</g>` : ""}
    </g>`;
  }

  renderSection(section) {
    const anonymousSpaces = (section.anonymousSpaces ?? []).map((space) => this.renderAnonymousSpace(space)).join("");
    const corridors = (section.corridors ?? []).map((corridor) => {
      const { x, y, width, height } = corridor.geometry;
      return `<g class="map-architecture-corridor" data-architecture-id="${escapeHtml(corridor.id)}" aria-hidden="true">
        <g class="map-architecture-corridor__shell">
        <rect class="map-architecture-corridor__wall" x="${x}" y="${y}" width="${width}" height="${height}"></rect>
        <rect class="map-architecture-corridor__surface" x="${x + 5}" y="${y + 5}" width="${width - 10}" height="${height - 10}"></rect>
        <rect class="map-architecture-corridor__floor" x="${x + 10}" y="${y + 10}" width="${width - 20}" height="${height - 20}"></rect>
        </g>
        <path class="map-architecture-corridor__centreline" d="M ${x + width / 2} ${y + 18} V ${y + height - 18}"></path>
        <text x="${x + width / 2}" y="${y + height / 2}" text-anchor="middle" transform="rotate(-90 ${x + width / 2} ${y + height / 2})">${escapeHtml(corridor.label ?? "FLUR")}</text>
      </g>`;
    }).join("");
    return `<g class="map-section" data-map-section="${escapeHtml(section.id)}">
      <path class="school-map__building-outline" d="${escapeHtml(section.outline)}"></path>
      <text class="map-section__label" x="1135" y="582" text-anchor="end">${escapeHtml(section.label ?? section.id)}</text>
      ${corridors}${anonymousSpaces}
    </g>`;
  }

  renderAnonymousSpace(space) {
    const { x, y, width, height } = space.geometry;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    return `<g class="map-architecture-space map-room--unbekannt${space.locked ? " map-room--verschlossen" : ""}" data-architecture-id="${escapeHtml(space.id)}" aria-label="${space.locked ? "Verschlossener, unbekannter Gebäuderaum" : "Unbekannter Gebäuderaum"}">
      <g class="map-room__shell">
      <rect class="map-room__wall" x="${x}" y="${y}" width="${width}" height="${height}" rx="4"></rect>
      <rect class="map-room__surface" x="${x + 6}" y="${y + 6}" width="${Math.max(0, width - 12)}" height="${Math.max(0, height - 12)}" rx="1"></rect>
      <rect class="map-room__floor" x="${x + 11}" y="${y + 11}" width="${Math.max(0, width - 22)}" height="${Math.max(0, height - 22)}" rx="1"></rect>
      <rect class="map-room__inner-wall" x="${x + 6}" y="${y + 6}" width="${Math.max(0, width - 12)}" height="${Math.max(0, height - 12)}" rx="1"></rect>
      <path class="map-room__wall-detail" d="M ${x + 16} ${y + height - 15} H ${x + width - 16} M ${x + 15} ${y + 16} V ${y + height - 15}"></path>
      </g>
      <text class="map-room__unknown" x="${centerX}" y="${centerY + 7}" text-anchor="middle">???</text>
      ${space.locked ? `<g transform="translate(${centerX} ${centerY + 38})">${statusSymbolMarkup("verschlossen")}</g>` : ""}
    </g>`;
  }

  renderConnection(connection) {
    return `<path class="map-connection" data-connection-id="${escapeHtml(connection.id)}" d="${escapeHtml(connection.path)}"></path>`;
  }

  renderLegendStatus(status, label) {
    return `<span><svg class="legend-status map-room map-room--${status}" viewBox="-16 -16 32 32" aria-hidden="true"><rect class="map-room__surface" x="-14" y="-11" width="28" height="22" rx="1"></rect>${statusSymbolMarkup(status)}</svg>${label}</span>`;
  }

  renderDoor(door, architectural = false) {
    const opensUp = door.side === "bottom";
    const direction = opensUp ? -1 : 1;
    const leaf = `M -20 0 V ${direction * 30} M -20 ${direction * 30} A 30 30 0 0 ${opensUp ? 1 : 0} 10 0`;
    return `<g class="map-door${architectural ? " map-door--architectural" : ""}" data-door-id="${escapeHtml(door.id)}" transform="translate(${door.x} ${door.y})" aria-hidden="true">
      <path class="map-door__opening" d="M -22 0 H 22"></path><path class="map-door__leaf" d="${leaf}"></path><circle class="map-door__handle" cx="-16" cy="${direction * 24}" r="2"></circle>
    </g>`;
  }
}
