import "@testing-library/jest-dom/vitest"

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: (query: string) => ({
    addEventListener: () => undefined,
    dispatchEvent: () => false,
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: () => undefined,
  }),
})

Object.defineProperties(HTMLElement.prototype, {
  hasPointerCapture: { value: () => false },
  releasePointerCapture: { value: () => undefined },
  scrollIntoView: { value: () => undefined },
  setPointerCapture: { value: () => undefined },
})
