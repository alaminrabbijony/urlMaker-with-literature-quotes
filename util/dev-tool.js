require("dotenv").config();
const fs = require("fs");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seed() {
  try {
    const quotes = JSON.parse(
      fs.readFileSync(`${__dirname}/quotes.json`, "utf-8")
    );

    console.log(`Inserting ${quotes.length} quotes...`);

    for (const quote of quotes) {
      await pool.query(
        `INSERT INTO quotes (content, author, year, tags)
         VALUES ($1, $2, $3, $4)`,
        [quote.content, quote.author, quote.year, quote.tags]
      );
    }

    console.log("Quotes seeded successfully 🚀");
  } catch (err) {
    console.error("Seeding failed:", err);
  } finally {
    await pool.end();
    process.exit();
  }
}

seed();

/**
 const values = [];
const placeholders = [];

quotes.forEach((q, index) => {
  const baseIndex = index * 4;
  placeholders.push(
    `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4})`
  );
  values.push(q.content, q.author, q.year, q.tags);
});

await pool.query(
  `INSERT INTO quotes (content, author, year, tags)
   VALUES ${placeholders.join(",")}`,
  values
);
 */

