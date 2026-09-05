import fs from "node:fs/promises";
import path from "node:path";
import { GUIDES, guideByNum } from "@/data/generated/guides.js";

/* Guide bodies are read on the server at request time and never bundled.
   The generated index (titles, headings, tags) is small and client-safe. */
export async function loadGuideBody(num) {
  const g = guideByNum(num);
  if (!g) return null;
  const file = path.join(process.cwd(), "content/guides", g.file);
  const raw = await fs.readFile(file, "utf8");
  return { ...g, body: raw.replace(/^<!--[\s\S]*?-->\s*/, "") };
}

export { GUIDES, guideByNum };
