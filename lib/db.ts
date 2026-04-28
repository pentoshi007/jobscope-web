import { MongoClient } from "mongodb";
import mongoose from "mongoose";
import { env } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache:
    | { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
    | undefined;
  // eslint-disable-next-line no-var
  var _mongoClient: MongoClient | undefined;
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | null | undefined;
}

const cache = global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cache;

export async function connectMongoose(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = mongoose
      .connect(env.MONGODB_URI, {
        bufferCommands: false,
        maxPoolSize: 10,
        minPoolSize: 0,
        serverSelectionTimeoutMS: 10000,
      })
      .then((m) => m)
      .catch((error) => {
        cache.promise = null;
        cache.conn = null;
        throw error;
      });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}

function getClient(): MongoClient {
  if (!global._mongoClient) {
    global._mongoClient = new MongoClient(env.MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10000,
    });
  }
  return global._mongoClient;
}

export const mongoClient = getClient();

export function getMongoClient(): Promise<MongoClient> {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = mongoClient.connect().catch((error) => {
      global._mongoClientPromise = null;
      throw error;
    });
  }
  return global._mongoClientPromise;
}

export function getDb() {
  return mongoClient.db();
}
