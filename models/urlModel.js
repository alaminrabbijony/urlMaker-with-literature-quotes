const {
  integer,
  pgTable,
  varchar,
  timestamp,
  pgEnum,
  //uniqueIndex
} = require("drizzle-orm/pg-core");
const { usersTable } = require("./usersMOdel");
const { uniqueIndex } = require("drizzle-orm/pg-core");
const { index } = require("drizzle-orm/pg-core");

const urlTable = pgTable(
  "url_table",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: integer()
      .references(() => usersTable.id, { onDelete: "cascade" })
      .notNull(),
    code: varchar({ length: 255 }).unique(),
    targetUrl: varchar({ length: 255 }).notNull(),

    expiresAt: timestamp({ withTimezone: true }).notNull(),
    clickCount: integer().default(0).notNull(),

    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  //INDEXING
  (table) => ({
    codeUniqueIdx: uniqueIndex("url_code_unique_indx").on(table.code),
    expiresAtIdx: index("expiresAt_index").on(table.expiresAt),
  }),
);

module.exports = { urlTable };
