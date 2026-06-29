import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// postgres.js client. `prepare: false` keeps us compatible with pooled
// connections (PgBouncer / Neon pooler) used in production. Works identically
// against the local Docker Postgres in development.
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export { schema };
