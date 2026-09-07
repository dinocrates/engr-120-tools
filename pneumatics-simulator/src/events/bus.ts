/** Minimal typed event bus (SDD §32). */

export type SimEventType =
  | "circuit:changed"
  | "selection:changed"
  | "mode:changed"
  | "pending:changed"
  | "sim:reset"
  | "sim:started"
  | "sim:paused"
  | "sim:tick"
  | "valve:changed"
  | "cylinder:moved"
  | "pressure:changed"
  | "status:changed";

type Handler = (payload?: unknown) => void;

export class EventBus {
  private handlers = new Map<SimEventType, Set<Handler>>();

  on(type: SimEventType, fn: Handler): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(fn);
    return () => set!.delete(fn);
  }

  emit(type: SimEventType, payload?: unknown): void {
    this.handlers.get(type)?.forEach((fn) => fn(payload));
  }
}
