const { integer, pgTable, varchar, timestamp } = require("drizzle-orm/pg-core");

const usersTable = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  password: varchar({ length: 255 }).notNull(),
  passwordChangedAt: timestamp("password_changed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

const passwordChangeHistoryTable = pgTable("password_change_history", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: integer().notNull().references(usersTable.id),
  changedAt: timestamp("pass_changed_at").defaultNow().notNull(),
  ipAddress: varchar({ length: 100 }),
  userAgent: varchar({ length: 255 }),
});

// fn for book keeping password change history
/* 
await db.transaction(async (tx) => {
  await tx.update(usersTable)
    .set({
      password: hashedPassword,
      passwordChangedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, userId));

  await tx.insert(passwordHistoryTable).values({
    userId,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });
});
*/
module.exports = { usersTable, passwordChangeHistoryTable };
