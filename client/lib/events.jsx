// Page-wide notifications between components (follow changes, new reviews)
const handlers = {};

export function on(name, handler) {
  (handlers[name] = handlers[name] || new Set()).add(handler);
  return () => handlers[name].delete(handler);
}

export function emit(name, detail) {
  (handlers[name] || []).forEach((h) => h(detail));
}
