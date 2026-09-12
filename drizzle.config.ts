import { config } from "dotenv"
config({ path: ".env.local", quiet: true })

import { defineConfig } from "drizzle-kit"

if (!process.env.DATABASE_URL) {
  throw new Error("Add DATABASE_URL to .env.local, then retry.")
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
})
