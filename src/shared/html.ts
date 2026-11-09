// Small pure helpers for building HTML strings, shared by every screen.

// Escapes text for HTML (also inside attribute values).
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// "1 kitty", "3 kitties": `many` defaults to adding an s.
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
