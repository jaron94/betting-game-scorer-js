import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  return drizzle(neon(connectionString), { schema });
}
