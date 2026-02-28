/**
 * ============================
 * 1) FAIL-FAST: LOAD & VALIDATE ENV
 * ============================
 * Validating *before* importing app/db prevents loading heavy
 * dependencies or making rogue connections if config is missing.
 */

const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });

const REQUIRED_ENVS = ["DB_URL", "PORT"];

REQUIRED_ENVS.forEach((ev) => {
  if (!process.env[ev]) {
    console.error(`💥 FATAL: Missing required environment variable: ${ev}`);
    process.exit(1);
  }
});
/**
 * ============================
 * 2) IMPORT CORE DEPENDENCIES
 * ============================
 */

const app = require("./app");
const { myPool } = require("./db");

let server;

/**
 * ============================
 * 3) CONSOLIDATED GRACEFUL SHUTDOWN
 * ============================
 * Sequential shutdown: Stop HTTP -> Wait for mid-flight DB transactions -> Close Pool -> Exit.
 */
const gracefulShutdown = async (signal, exitCode = 0) => {
  console.log(
    `\n☢️ ${signal} received.\n Oh! I'am dynig 💀💀\n but i will die with gracefullyyyy...`,
  );
  // DEFENSIVE ENGINEERING: Prevent zombie processes if connections hang

  const forceExit = setTimeout(() => {
    console.error("💥 Shutdown timed out (10s). Forcing process exit.");
    process.exit(1);
  }, 10000);
  try {
    if (server) {
      console.log("🛑 Closing HTTP server (rejecting new requests)...");
      // Promisified for sequential execution and cleaner mental model
      await new Promise((resolve) => server.close(resolve));
      console.log("✅ In-flight requests completed.");
    }
    if (myPool) {
      console.log("🗄️ Draining PostgreSQL connection pool...");
      await myPool.end();
      console.log("✅ Database connections safely closed.");
    }
    clearTimeout(forceExit);
    process.exit(exitCode);
  } catch (error) {
    console.error("💥 Error during shutdown sequence:", error);
    process.exit(1);
  }
};

/**
 * ============================
 * 4) FATAL ERROR ROUTING
 * ============================
 */

//DEBATABLE
// process.on("uncaughtException", (err) => {
//   console.error("CRITICAL: Uncaught Exception! 💥", err);
//   gracefulShutdown("uncaughtException", 1);
// });

//Trying to gracefully shutdown after memory corruption is sometimes worse.
//RECOMMENDED BY NODE TEAM



process.on("uncaughtException", (err) => {
  console.error("CRITICAL: Uncaught Exception", err);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  console.error("CRITICAL: Unhandled Rejection! 💥", err);
  gracefulShutdown("unhandledRejection", 1);
});

// OS Signals from Docker, Kubernetes, or systemd
process.on("SIGTERM", () => gracefulShutdown("SIGTERM", 0));
process.on("SIGINT", () => gracefulShutdown("SIGINT", 0));

/**
 * ============================
 * 5) BOOTSTRAP SEQUENCE
 * ============================
 */

const start = async () => {
  try {
    await myPool.query("SELECT 1");
    console.log("✅ PostgreSQL pool established.");
    const port = process.env.PORT || 3000;

    server = app.listen(port, () => {
      console.log(`🚀 POS Server active on port ${port}`);
      // NOTE: Ensure app.js exposes a GET /health endpoint
    });
  } catch (error) {
    console.error("❌ System bootstrap failed:", error.message);
    process.exit(1);
  }
};

start();
