const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("pg");

const myPool = new Pool({
  connectionString: process.env.DB_URL,
});

const db = drizzle(myPool);

module.exports = { myPool, db };