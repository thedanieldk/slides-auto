import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "@/lib/db/schema"

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error("Add DATABASE_URL to .env.local, then restart the app.")
}

// prepare: false is required when connecting through Supabase's transaction
// pooler, which doesn't support prepared statements.
const client = postgres(connectionString, { prepare: false })

export const db = drizzle(client, { schema })
