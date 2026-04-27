// DOMException doesn't exist in React Native's JS environment but livekit-client
// references it at module load time (class extends DOMException). Must be imported
// before any livekit import.
if (typeof global.DOMException === 'undefined') {
  // @ts-ignore
  global.DOMException = class DOMException extends Error {
    constructor(message?: string, name?: string) {
      super(message);
      this.name = name ?? 'DOMException';
    }
  };
}
