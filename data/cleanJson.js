
const fs = require("fs");

const path = require("path");
/*
const quotes = JSON.parse(fs.readFileSync("quotes.json"));

const publicDomainAuthors = new Set([
  "Aristotle",
  "Marcus Aurelius",
  "William Shakespeare",
  "Benjamin Franklin",
  "Virgil",
  "Cicero",
  "Voltaire",
  "Mark Twain",
  "Thomas Jefferson",
  "Ralph Waldo Emerson",
  "Leonardo da Vinci"
]);

const filtered = quotes.filter(q =>
  publicDomainAuthors.has(q.author)
);

fs.writeFileSync(
  "quotes-public.json",
  JSON.stringify(filtered, null, 2)
);
*/


const inputPath = path.join(__dirname, "quotes-public.json");
//const outputPath = path.join(__dirname, "quotes-slug.json");

const quotes = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

const transformed = quotes.map(q => ({
  ...q,
  slug: slugify(q.quote)
}));

fs.writeFileSync("quotes-slug.json", JSON.stringify(transformed, null, 2));

console.log("Slug transformation complete 🚀");