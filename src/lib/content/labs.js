import fs from "node:fs/promises";
import path from "node:path";
import { LAB_INDEX, LAB_TRACKS, labById } from "@/data/generated/labs.js";

let cache = null;
async function all() {
  if (!cache) {
    const raw = await fs.readFile(path.join(process.cwd(), "content/labs.json"), "utf8");
    cache = JSON.parse(raw);
  }
  return cache;
}

/** The full lab — steps, sections, source — read on the server only. */
export async function loadLab(id) {
  const { labs } = await all();
  return labs.find((l) => l.id === id) || null;
}

export { LAB_INDEX, LAB_TRACKS, labById };
