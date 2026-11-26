import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

// The generated client: PrismaClient, the Prisma namespace (types and errors), and model enums.
export * from "./generated/prisma/client";
export { loadDatabaseEnv } from "./env";

/** Creates a client that talks to PostgreSQL through the node-postgres driver adapter. */
export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** Adapter factory for classes that extend PrismaClient (for example the API's PrismaService). */
export function createAdapter(connectionString: string) {
  return new PrismaPg({ connectionString });
}
