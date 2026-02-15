type SourceMessage = {
  id: string;
  sessionId: string;
};

type SourceSession = {
  id: string;
};

type ReferenceSourceDb = {
  message: {
    findFirst: (args: {
      where: { id: string; userId: string };
      select: { id: true; sessionId: true };
    }) => Promise<SourceMessage | null>;
  };
  session: {
    findFirst: (args: {
      where: { id: string; userId: string };
      select: { id: true };
    }) => Promise<SourceSession | null>;
  };
};

export class ReferenceSourceError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type ResolveReferenceSourceParams = {
  userId: string;
  sourceSessionId: string;
  sourceMessageId: string;
  db: ReferenceSourceDb;
};

export async function resolveReferenceSource({
  userId,
  sourceSessionId,
  sourceMessageId,
  db,
}: ResolveReferenceSourceParams): Promise<{
  sourceSessionId: string;
  sourceMessageId: string;
}> {
  let effectiveSourceSessionId = sourceSessionId;
  const effectiveSourceMessageId = sourceMessageId;

  let sourceMessage: SourceMessage | null = null;
  if (effectiveSourceMessageId) {
    sourceMessage = await db.message.findFirst({
      where: { id: effectiveSourceMessageId, userId },
      select: { id: true, sessionId: true },
    });

    if (!sourceMessage) {
      throw new ReferenceSourceError(404, "Source message not found", "SOURCE_MESSAGE_NOT_FOUND");
    }
  }

  if (effectiveSourceSessionId) {
    const session = await db.session.findFirst({
      where: { id: effectiveSourceSessionId, userId },
      select: { id: true },
    });

    if (!session) {
      throw new ReferenceSourceError(404, "Source session not found", "SOURCE_SESSION_NOT_FOUND");
    }
  }

  if (sourceMessage && !effectiveSourceSessionId) {
    effectiveSourceSessionId = sourceMessage.sessionId;
  }

  if (sourceMessage && effectiveSourceSessionId && sourceMessage.sessionId !== effectiveSourceSessionId) {
    throw new ReferenceSourceError(400, "SOURCE_RELATION_MISMATCH", "SOURCE_RELATION_MISMATCH");
  }

  return {
    sourceSessionId: effectiveSourceSessionId,
    sourceMessageId: effectiveSourceMessageId,
  };
}
