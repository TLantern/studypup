type Layout = { x: number; y: number; width: number; height: number };

let _layout: Layout | null = null;

export const welcomeIconRef = {
  set(l: Layout) { _layout = l; },
  get(): Layout | null { return _layout; },
};
