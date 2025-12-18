import { readFileSync } from "fs";
import { resolveProjectPath } from "../utils/paths.js";

export function loadConfig() {
  try {
    const p = resolveProjectPath("craig.config.json");
    const raw = readFileSync(p, "utf-8");
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}
