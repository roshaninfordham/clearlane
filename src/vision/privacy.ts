export const PRIVACY_NOTICE =
  "Do not identify people, read license plates, infer protected attributes, or make enforcement determinations.";

export function visionSystemPrompt(): string {
  return [
    "You are analyzing street operations evidence for a public agency.",
    "Do not identify people.",
    "Do not read or report license plates.",
    "Do not infer protected attributes.",
    "Only classify visible street, vehicle, curb, or lane conditions.",
    "Use uncertainty and require human review.",
    "Return JSON only."
  ].join(" ");
}
