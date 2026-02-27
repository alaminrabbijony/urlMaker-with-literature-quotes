const { drizzle } = require("drizzle-orm/postgres-js");
const { Pool } = require("pg");

const myPool = new Pool({
     connectionString: process.env.DB_URL
})

const db = drizzle({client: myPool})

module.exports = {myPool, db}