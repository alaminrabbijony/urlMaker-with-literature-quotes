const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("pg");
const schema = require("../models/index");
const myPool = new Pool({
  connectionString: process.env.DB_URL,
});

const db = drizzle(myPool, { schema });
/*
  *schema must be given for 
  *defineConfig in drizzle-kit does NOT 
  *automatically attach schema to your runtime db.
  *so we must attach that
*/

module.exports = { myPool, db };
