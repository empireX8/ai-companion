import { describe, expect, it } from "vitest";

import {
  applyContradictionAction,
  ContradictionTransitionError,
} from "../contradiction-transitions";

describe("applyContradictionAction", () => {
  it("maps valid transitions", () => {
    expect(applyContradictionAction("open", "snooze")).toEqual({
      nextStatus: "snoozed",
      touches: { snooze: true },
    });
    expect(applyContradictionAction("open", "explore")).toEqual({
      nextStatus: "explored",
      touches: {},
    });
    expect(applyContradictionAction("explored", "resolve")).toEqual({
      nextStatus: "resolved",
      touches: {},
    });
    expect(applyContradictionAction("explored", "accept_tradeoff")).toEqual({
      nextStatus: "accepted_tradeoff",
      touches: {},
    });
    expect(applyContradictionAction("open", "archive_tension")).toEqual({
      nextStatus: "archived_tension",
      touches: {},
    });
    expect(applyContradictionAction("resolved", "reopen")).toEqual({
      nextStatus: "open",
      touches: {},
    });
    expect(applyContradictionAction("open", "avoid")).toEqual({
      nextStatus: "open",
      touches: { avoid: true },
    });
    expect(applyContradictionAction("open", "surface_ack")).toEqual({
      nextStatus: "open",
      touches: {},
    });
  });

  it("rejects invalid reopen and terminal transitions", () => {
    expect(() => applyContradictionAction("open", "reopen")).toThrowError(
      ContradictionTransitionError
    );
    expect(() => applyContradictionAction("archived_tension", "explore")).toThrowError(
      ContradictionTransitionError
    );
    expect(() =>
      applyContradictionAction("accepted_tradeoff", "accept_tradeoff")
    ).toThrowError(ContradictionTransitionError);
  });

  it("unsnooze transitions snoozed → open", () => {
    expect(applyContradictionAction("snoozed", "unsnooze")).toEqual({
      nextStatus: "open",
      touches: {},
    });
  });

  it("unsnooze rejects any status that is not snoozed", () => {
    expect(() => applyContradictionAction("open", "unsnooze")).toThrowError(
      ContradictionTransitionError
    );
    expect(() => applyContradictionAction("explored", "unsnooze")).toThrowError(
      ContradictionTransitionError
    );
    expect(() => applyContradictionAction("resolved", "unsnooze")).toThrowError(
      ContradictionTransitionError
    );
  });
});
