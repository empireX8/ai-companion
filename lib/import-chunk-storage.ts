import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export type ChunkStorage = {
  putChunk: (params: {
    sessionId: string;
    chunkIndex: number;
    bytes: Buffer;
  }) => Promise<void>;
  getChunkStream: (sessionId: string, chunkIndex: number) => Promise<Readable>;
  deleteChunks: (sessionId: string) => Promise<void>;
};

const readEnv = (key: string) => {
  const value = process.env[key];
  return value && value.length > 0 ? value : null;
};

const chunkObjectKey = (sessionId: string, chunkIndex: number) =>
  `imports/${sessionId}/${String(chunkIndex).padStart(8, "0")}.part`;

export class LocalFsChunkStorage implements ChunkStorage {
  constructor(private readonly baseDir: string) {}

  private sessionDir(sessionId: string) {
    return path.join(this.baseDir, sessionId);
  }

  private chunkPath(sessionId: string, chunkIndex: number) {
    return path.join(this.sessionDir(sessionId), `${chunkIndex}.part`);
  }

  async putChunk({ sessionId, chunkIndex, bytes }: { sessionId: string; chunkIndex: number; bytes: Buffer }) {
    await mkdir(this.sessionDir(sessionId), { recursive: true });
    const writeStream = createWriteStream(this.chunkPath(sessionId, chunkIndex), {
      flags: "w",
    });
    await pipeline(Readable.from(bytes), writeStream);
  }

  async getChunkStream(sessionId: string, chunkIndex: number) {
    return createReadStream(this.chunkPath(sessionId, chunkIndex));
  }

  async deleteChunks(sessionId: string) {
    const sessionDir = this.sessionDir(sessionId);
    await rm(sessionDir, { recursive: true, force: true });
  }

  async getStoredChunkIndexes(sessionId: string): Promise<number[]> {
    const sessionDir = this.sessionDir(sessionId);
    try {
      const files = await readdir(sessionDir);
      return files
        .map((name) => Number.parseInt(name.replace(/\.part$/, ""), 10))
        .filter((value) => Number.isInteger(value))
        .sort((a, b) => a - b);
    } catch {
      return [];
    }
  }
}

export class S3CompatibleChunkStorage implements ChunkStorage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string
  ) {}

  async putChunk({ sessionId, chunkIndex, bytes }: { sessionId: string; chunkIndex: number; bytes: Buffer }) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: chunkObjectKey(sessionId, chunkIndex),
        Body: bytes,
      })
    );
  }

  async getChunkStream(sessionId: string, chunkIndex: number) {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: chunkObjectKey(sessionId, chunkIndex),
      })
    );

    if (!response.Body || !(response.Body instanceof Readable)) {
      throw new Error(`Missing chunk stream for session ${sessionId} chunk ${chunkIndex}`);
    }

    return response.Body;
  }

  async deleteChunks(sessionId: string) {
    const prefix = `imports/${sessionId}/`;
    let continuationToken: string | undefined;

    do {
      const listed = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );

      const keys = listed.Contents?.map((item) => item.Key).filter((key): key is string => Boolean(key)) ?? [];
      if (keys.length > 0) {
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: {
              Objects: keys.map((key) => ({ Key: key })),
            },
          })
        );
      }

      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);
  }
}

let storageSingleton: ChunkStorage | null = null;

const buildS3Client = () => {
  const region = readEnv("IMPORT_S3_REGION") ?? "auto";
  const endpoint = readEnv("IMPORT_S3_ENDPOINT") ?? undefined;
  const accessKeyId = readEnv("IMPORT_S3_ACCESS_KEY");
  const secretAccessKey = readEnv("IMPORT_S3_SECRET");

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("S3 chunk storage requires IMPORT_S3_ACCESS_KEY and IMPORT_S3_SECRET");
  }

  return new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });
};

export const getChunkStorage = (): ChunkStorage => {
  if (storageSingleton) {
    return storageSingleton;
  }

  const provider = (readEnv("IMPORT_STORAGE_PROVIDER") ?? "local_fs").toLowerCase();
  if (provider === "s3") {
    const bucket = readEnv("IMPORT_BUCKET");
    if (!bucket) {
      throw new Error("IMPORT_BUCKET is required when IMPORT_STORAGE_PROVIDER=s3");
    }

    storageSingleton = new S3CompatibleChunkStorage(buildS3Client(), bucket);
    return storageSingleton;
  }

  const baseDir = path.join(process.cwd(), ".tmp", "imports");
  storageSingleton = new LocalFsChunkStorage(baseDir);
  return storageSingleton;
};
