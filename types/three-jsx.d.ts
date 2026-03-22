// R3F v8 type augmentation for Three.js JSX elements
// Extends React's JSX.IntrinsicElements with R3F's ThreeElements
import type { ThreeElements } from '@react-three/fiber'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
