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
    
  }
} catch (error) {
  
}

};

module.exports = gracefulShutdown;
