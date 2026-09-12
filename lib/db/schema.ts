import { relations } from "drizzle-orm"
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import type { CompositionResult } from "@/lib/composition"
import type { SlideshowSlide } from "@/lib/slideshow"

export const productProfiles = pgTable("product_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Anonymous per-browser id for now (see lib/auth/current-user.ts). Swap
  // the id source for a real auth user id later without touching this column.
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  niche: text("niche").notNull(),
  valueProposition: text("value_proposition").notNull(),
  sourceUrl: text("source_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const hooks = pgTable("hooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  productId: uuid("product_id").references(() => productProfiles.id, {
    onDelete: "set null",
  }),
  frameworkId: text("framework_id").notNull(),
  text: text("text").notNull(),
  generatedCopy: jsonb("generated_copy").$type<CompositionResult>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const slideshows = pgTable("slideshows", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(),
  themeId: text("theme_id").notNull(),
  activeSlideId: text("active_slide_id").notNull(),
  slides: jsonb("slides").$type<SlideshowSlide[]>().notNull(),
  sourceHookId: uuid("source_hook_id").references(() => hooks.id, {
    onDelete: "set null",
  }),
  productId: uuid("product_id").references(() => productProfiles.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const productProfilesRelations = relations(
  productProfiles,
  ({ many }) => ({
    hooks: many(hooks),
    slideshows: many(slideshows),
  })
)

export const hooksRelations = relations(hooks, ({ one, many }) => ({
  product: one(productProfiles, {
    fields: [hooks.productId],
    references: [productProfiles.id],
  }),
  slideshows: many(slideshows),
}))

export const slideshowsRelations = relations(slideshows, ({ one }) => ({
  product: one(productProfiles, {
    fields: [slideshows.productId],
    references: [productProfiles.id],
  }),
  sourceHook: one(hooks, {
    fields: [slideshows.sourceHookId],
    references: [hooks.id],
  }),
}))
