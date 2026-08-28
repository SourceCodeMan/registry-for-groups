import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const globalForPg = globalThis as unknown as {
  pg: ReturnType<typeof postgres> | undefined;
};

// postgres.js client. `prepare: false` keeps us compatible with pooled
// connections (PgBouncer / Neon pooler) used in production. `max: 1` so each
// serverless isolate doesn't open a 10-connection burst.
const client =
  globalForPg.pg ??
  postgres(connectionString, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });
if (process.env.NODE_ENV !== "production") globalForPg.pg = client;

export const db = drizzle(client, { schema });
export { schema };
