import { Redis } from "@upstash/redis";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";

export type SessionKey = {
  userId: string;
  sessionId: string;
  modelName: string;
};

export type MemoryScope = "session" | "user";

type MemoryMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
};

const MAX_TRANSCRIPT_CHARS = 20_000;
const DEFAULT_READ_LIMIT = 8_000;

export class SessionMemoryManager {
  private static instance: SessionMemoryManager;
  private redis: Redis | null;
  private vectorStorePromise: Promise<PineconeStore | null> | null = null;

  private constructor() {
    this.redis = this.createRedisClient();
  }

  public static async getInstance(): Promise<SessionMemoryManager> {
    if (!SessionMemoryManager.instance) {
      SessionMemoryManager.instance = new SessionMemoryManager();
    }
    return SessionMemoryManager.instance;
  }

  public async appendToTranscript(
    key: SessionKey,
    line: string,
    scope: MemoryScope = "session"
  ): Promise<void> {
    if (!this.redis || !line.trim()) {
      return;
    }

    try {
      const transcriptKey = this.getTranscriptKey(key, scope);
      const existingValue = await this.redis.get<string>(transcriptKey);
      const existingTranscript =
        typeof existingValue === "string" ? existingValue : "";
      const nextTranscript = existingTranscript
        ? `${existingTranscript}\n${line}`
        : line;
      const cappedTranscript =
        nextTranscript.length > MAX_TRANSCRIPT_CHARS
          ? nextTranscript.slice(-MAX_TRANSCRIPT_CHARS)
          : nextTranscript;

      await this.redis.set(transcriptKey, cappedTranscript);
    } catch {
      // Best effort only.
    }
  }

  public async readTranscript(
    key: SessionKey,
    limitChars: number = DEFAULT_READ_LIMIT,
    scope: MemoryScope = "session"
  ): Promise<string> {
    if (!this.redis) {
      return "";
    }

    try {
      const transcriptKey = this.getTranscriptKey(key, scope);
      const value = await this.redis.get<string>(transcriptKey);
      if (typeof value !== "string" || !value) {
        return "";
      }

      return value.length > limitChars ? value.slice(-limitChars) : value;
    } catch {
      return "";
    }
  }

  public async upsertVector(
    key: SessionKey,
    message: MemoryMessage,
    scope: MemoryScope = "session"
  ): Promise<void> {
    const content = message.content.trim();
    if (!content) {
      return;
    }

    try {
      const vectorStore = await this.getVectorStore();
      if (!vectorStore) {
        return;
      }

      const doc = new Document({
        pageContent: content,
        metadata: {
          userId: key.userId,
          sessionId: key.sessionId,
          scope,
          messageId: message.id,
          role: message.role,
          createdAt: message.createdAt.toISOString(),
          modelName: key.modelName,
        },
      });

      await vectorStore.addDocuments([doc], {
        ids: [`${scope}:${key.userId}:${key.sessionId}:${message.id}`],
      });
    } catch {
      // Best effort only.
    }
  }

  public async queryRelevant(
    key: SessionKey,
    query: string,
    topK: number = 6,
    scope: MemoryScope = "session"
  ): Promise<string> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return "";
    }

    try {
      const vectorStore = await this.getVectorStore();
      if (!vectorStore) {
        return "";
      }

      const filter =
        scope === "session"
          ? { userId: key.userId, sessionId: key.sessionId, scope: "session" }
          : { userId: key.userId, scope: "user" };

      const docs = await vectorStore.similaritySearch(trimmedQuery, topK, filter);

      const snippets = docs
        .map((doc) => String(doc.pageContent ?? "").trim())
        .filter(Boolean);

      return snippets.join("\n");
    } catch {
      return "";
    }
  }

  private createRedisClient(): Redis | null {
    try {
      const hasUpstash =
        Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
        Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);
      const hasGenericRedis = Boolean(process.env.REDIS_URL);

      if (!hasUpstash && !hasGenericRedis) {
        return null;
      }

      return Redis.fromEnv();
    } catch {
      return null;
    }
  }

  private async getVectorStore(): Promise<PineconeStore | null> {
    if (!this.vectorStorePromise) {
      this.vectorStorePromise = this.createVectorStore();
    }

    return this.vectorStorePromise;
  }

  private async createVectorStore(): Promise<PineconeStore | null> {
    try {
      const pineconeApiKey = process.env.PINECONE_API_KEY;
      const pineconeIndexName = process.env.PINECONE_INDEX;
      const openAIApiKey = process.env.OPENAI_API_KEY;

      if (!pineconeApiKey || !pineconeIndexName || !openAIApiKey) {
        return null;
      }

      const pinecone = new Pinecone({ apiKey: pineconeApiKey });
      const pineconeIndex = pinecone.index(pineconeIndexName);

      return await PineconeStore.fromExistingIndex(
        new OpenAIEmbeddings({ apiKey: openAIApiKey }),
        { pineconeIndex }
      );
    } catch {
      return null;
    }
  }

  private getTranscriptKey(key: SessionKey, scope: MemoryScope): string {
    if (scope === "user") {
      return `double:user:${key.userId}:transcript`;
    }

    return `double:session:${key.userId}:${key.sessionId}:transcript`;
  }
}
