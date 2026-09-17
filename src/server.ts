import "dotenv/config";
import { createApp } from "./app.js";
import { closePool } from "./config/database.js";
import { getEnv } from "./config/env.js";

const env = getEnv();
const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`Leeford API listening on port ${env.PORT}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received; shutting down gracefully`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
