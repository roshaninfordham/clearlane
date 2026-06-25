export function redactSecret(value: string | undefined): string {
  if (!value) return "";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 3)}…${value.slice(-3)}`;
}

export function redactObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        /api[_-]?key|token|secret|authorization/i.test(key) ? "[redacted]" : redactObject(child)
      ])
    );
  }
  return value;
}
