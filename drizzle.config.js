const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });
const { defineConfig } = require("drizzle-kit");

const config = defineConfig({
  out: "./drizzle",
  schema: "./db/index.js",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DB_URL,
  },
});
module.exports = config