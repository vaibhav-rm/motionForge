/**
 * JSON response parsing.
 *
 * Models wrap JSON in prose or code fences often enough that a strict
 * `JSON.parse` is not viable. This extractor is deliberately forgiving about
 * the wrapper and strict about the payload.
 */

export function parseJsonResponse(text: string): unknown {
  const trimmed = text.trim();

  // Direct parse.
  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue to the fallbacks.
  }

  // Strip markdown code fences.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // Continue.
    }
  }

  // Extract the outermost JSON object or array.
  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd > objectStart) {
    try {
      return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
    } catch {
      // Continue.
    }
  }

  const arrayStart = trimmed.indexOf("[");
  const arrayEnd = trimmed.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    try {
      return JSON.parse(trimmed.slice(arrayStart, arrayEnd + 1));
    } catch {
      // Continue.
    }
  }

  throw new Error(
    "The AI response did not contain valid JSON. It started with: " +
      trimmed.slice(0, 120),
  );
}
