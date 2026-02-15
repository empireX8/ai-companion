import { describe, expect, it, vi } from "vitest";

import { claimStripeEvent } from "../stripe-event-idempotency";

describe("claimStripeEvent", () => {
  it("returns false for duplicate event ids (P2002)", async () => {
    const db = {
      stripeEvent: {
        create: vi.fn().mockRejectedValue({ code: "P2002" }),
      },
    };

    await expect(claimStripeEvent("evt_123", db)).resolves.toBe(false);
  });

  it("returns true for first-time event ids", async () => {
    const db = {
      stripeEvent: {
        create: vi.fn().mockResolvedValue({ id: "evt_123" }),
      },
    };

    await expect(claimStripeEvent("evt_123", db)).resolves.toBe(true);
  });
});
