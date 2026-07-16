type Listener = () => void;

let _open = false;
const listeners = new Set<Listener>();

export function getShowAddSheet(): boolean {
  return _open;
}

export function setShowAddSheet(value: boolean): void {
  if (_open === value) return;
  _open = value;
  listeners.forEach((listener) => listener());
}

export function subscribeAddSheet(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
