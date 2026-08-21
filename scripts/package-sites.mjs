import { copyFile, cp, mkdir } from "node:fs/promises";

await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await copyFile("sites-server.js", "dist/server/index.js");
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
await copyFile("game.js", "dist/game.js");
await copyFile("THIRD_PARTY_ASSETS.md", "dist/THIRD_PARTY_ASSETS.md");
await cp("assets", "dist/assets", { recursive: true });
