// A new random id for a saved record (a cat, a quest, a shopping item, a birthday...).
export const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
