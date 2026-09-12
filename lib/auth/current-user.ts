import "server-only"
import { cookies } from "next/headers"

const USER_ID_COOKIE = "slides-auto.user-id"
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/**
 * Anonymous per-browser identity until real auth exists. Every table has a
 * user_id column already, so switching this to a real authenticated user id
 * later is a one-function change, not a schema migration.
 */
export async function getCurrentUserId(): Promise<string> {
  const cookieStore = await cookies()
  const existing = cookieStore.get(USER_ID_COOKIE)?.value
  if (existing) return existing

  const id = crypto.randomUUID()
  cookieStore.set(USER_ID_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR_SECONDS * 5,
    path: "/",
  })
  return id
}
