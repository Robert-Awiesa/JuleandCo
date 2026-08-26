/**
 * Plain stylesheet imports.
 *
 * Next declares `*.module.css` in its own types but not bare `*.css`, so a
 * side-effect import like `import "../globals.css"` has no declaration behind
 * it. TypeScript 5.9 lets that pass silently; newer versions report it as
 * ts(2882) — "Cannot find module or type declarations for side-effect import" —
 * which is why it shows in an editor running a newer compiler than the one
 * pinned here, and why it would become a build error on the next upgrade.
 *
 * A bare `declare module` gives the import a type of `any`, which is exactly
 * right: nothing reads a value from it, the bundler handles the file, and the
 * import exists purely for its side effect.
 *
 * `*.module.css` is the more specific pattern, so Next's typed declaration for
 * CSS Modules still wins over this one.
 */
declare module "*.css";
