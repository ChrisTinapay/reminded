import type { Chunk } from "./chunking";

/**
 * Pure prompt formatters (no external deps).
 * Keep these short: the worker will do map-reduce, so each prompt is small.
 */

export function mapPromptForChunk(chunk: Chunk) {
  return [
    "You are extracting study facts from a document chunk.",
    "Return ONLY JSON.",
    "",
    "JSON schema:",
    `{ "notes": string[], "keywords": string[] }`,
    "",
    "Rules:",
    "- Notes must be concise (<= 18 words each).",
    "- Prefer definitions, formulas, rules, and key distinctions.",
    "- Avoid duplicates and filler.",
    "",
    `Chunk #${chunk.index}:`,
    chunk.text,
  ].join("\n");
}

export function reducePromptForQuestions(allNotes: string[]) {
  return [
    "Using the notes below, generate 20 multiple-choice questions.",
    "Return ONLY JSON as an array of objects with fields:",
    `question_text (string), choices (string[4]), correct_answer (string), bloom_level (string)`,
    "",
    "CRITICAL CONSTRAINTS:",
    "- question_text under 20 words",
    "- each choice under 5 words",
    "- answerable within 10 seconds",
    "- distribute correct answers evenly across A/B/C/D",
    "- keep choices mutually exclusive",
    "",
    "Notes:",
    ...allNotes.map((n) => `- ${n}`),
  ].join("\n");
}

