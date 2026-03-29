import { AppServer } from "./app/server/appServer.mjs";

console.log("[START] Starting SeedWorld App Server...");

const server = new AppServer();

await server.listen();

console.log("[START] Server started successfully!");
console.log("[HTTP] Launcher: http://127.0.0.1:3000/");
console.log("[HTTP] Game: http://127.0.0.1:3000/game");
console.log("[INFO] Press Ctrl+C to stop server");

process.on("SIGINT", () => {
  console.log("\n[STOP] Shutting down server...");
  server.close();
  process.exit(0);
});
