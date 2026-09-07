const routeStep = (roomId, { completeRoomId = null, revealConnectionId = null } = {}) => Object.freeze({
  roomId,
  completeRoomId,
  revealConnectionId
});

/** One shared spatial route for both internal follow-up packages. */
export const PHASE_TWO_ROUTE = Object.freeze({
  1: routeStep("unknown-a01"),
  2: routeStep("unknown-a01"),
  3: routeStep("unknown-a01", {
    completeRoomId: "unknown-a01",
    revealConnectionId: "transfer-energy"
  }),
  4: routeStep("energielabor"),
  5: routeStep("energielabor"),
  6: routeStep("energielabor"),
  7: routeStep("energielabor", { completeRoomId: "energielabor" })
});

export const getPhaseTwoRouteStep = (order) => PHASE_TWO_ROUTE[order] ?? null;
