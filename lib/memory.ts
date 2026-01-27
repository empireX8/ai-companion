import { Redis } from "@upstash/redis";
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";

export type CompanionKey = {
  companionName: string;
  modelName: string;
  userId: string;
};

export class MemoryManager {
  private static instance: MemoryManager;
  private history: Redis;
  private pinecone: Pinecone;

  private constructor() {
    this.history = Redis.fromEnv();
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
  }

  public static async getInstance(): Promise<MemoryManager> {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  private getIndex() {
    return this.pinecone.index(process.env.PINECONE_INDEX!);
  }

  public async vectorSearch(
    recentChatHistory: string,
    companionFileName: string
  ) {
    const index = this.getIndex();

    const vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({
        apiKey: process.env.OPENAI_API_KEY!,
      }),
      { pineconeIndex: index }
    );

    const similarDocs = await vectorStore.similaritySearch(
      recentChatHistory,
      3,
      { fileName: companionFileName }
    );

    return similarDocs;
  }

  private generateRedisCompanionKey(companionKey: CompanionKey): string {
    return `${companionKey.companionName}-${companionKey.modelName}-${companionKey.userId}`;
  }

  public async writeToHistory(text: string, companionKey: CompanionKey) {
    if (!companionKey?.userId) return;

    const key = this.generateRedisCompanionKey(companionKey);

    await this.history.zadd(key, {
      score: Date.now(),
      member: text,
    });
  }

  public async readLatestHistory(
    companionKey: CompanionKey
  ): Promise<string> {
    if (!companionKey?.userId) return "";

    const key = this.generateRedisCompanionKey(companionKey);

    const result = await this.history.zrange(key, 0, Date.now(), {
      byScore: true,
    });

    return result.slice(-30).join("\n");
  }

  public async seedChatHistory(
    seedContent: string,
    delimiter: string = "\n",
    companionKey: CompanionKey
  ) {
    const key = this.generateRedisCompanionKey(companionKey);

    if (await this.history.exists(key)) return;

    const content = seedContent.split(delimiter);
    let counter = 0;

    for (const line of content) {
      await this.history.zadd(key, {
        score: counter++,
        member: line,
      });
    }
  }
}
