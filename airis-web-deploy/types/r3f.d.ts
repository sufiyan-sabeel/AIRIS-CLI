// Minimal JSX type augmentations for @react-three/fiber Three.js elements.
// Using [key: string]: any catch-all to avoid module boundary issues.

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}
