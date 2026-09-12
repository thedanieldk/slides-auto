import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core"

/**
 * Smoke-test table only, to prove the Supabase connection and the
 * db:generate / db:migrate pipeline work end to end. Replace with real
 * tables once we know what needs to persist server-side.
 */
export const dbHealthCheck = pgTable("db_health_check", {
  id: uuid("id").primaryKey().defaultRandom(),
  checkedAt: timestamp("checked_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})
