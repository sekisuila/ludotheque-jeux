import { mkdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const source = resolve(root, "node_modules", "stockfish");
const target = resolve(root, "public", "vendor", "stockfish");

await mkdir(target, { recursive: true });

for (const [from, to] of [
  ["bin/stockfish-19-lite-single.js", "stockfish-19-lite-single.js"],
  ["bin/stockfish-19-lite-single.wasm", "stockfish-19-lite-single.wasm"],
  ["Copying.txt", "Copying.txt"]
]) {
  await copyFile(resolve(source, from), resolve(target, to));
}

console.log("Stockfish 19 lite single-threaded copié dans public/vendor/stockfish.");
