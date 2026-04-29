/**
 * stream.d.ts
 * -----------
 * Tells TypeScript that CSS side-effect imports from the GetStream SDK are
 * valid, so `import "...styles.css"` no longer raises TS2882.
 *
 * Place this file anywhere inside your `src/` (or project root) so TypeScript
 * picks it up via tsconfig `include` / `typeRoots`.
 */
declare module "@stream-io/video-react-sdk/dist/css/styles.css" {
  const styles: Record<string, string>;
  export default styles;
}

// Also silence any other *.css imports that TS complains about:
declare module "*.css" {
  const styles: Record<string, string>;
  export default styles;
}
