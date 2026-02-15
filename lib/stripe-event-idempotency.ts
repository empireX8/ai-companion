import prismadb from "./prismadb";

type StripeEventDb = {
  stripeEvent: {
    create: (args: { data: { id: string } }) => Promise<{ id: string }>;
  };
};

const isUniqueConstraintError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string };
  return maybeError.code === "P2002";
};

export async function claimStripeEvent(
  eventId: string,
  db?: StripeEventDb
): Promise<boolean> {
  const targetDb = db ?? (prismadb as unknown as StripeEventDb);

  try {
    await targetDb.stripeEvent.create({
      data: { id: eventId },
    });
    return true;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return false;
    }
    throw error;
  }
}
