# Obsidian Plugin

## Build Commands
- `npm run dev` — Start esbuild in watch mode (auto-rebuilds on file changes)
- `npm run build` — Production build (runs tsc type-check then esbuild with minification)

## Architecture
- esbuild bundles `src/main.ts` → `main.js` (CommonJS, ES2018 target)
- The `obsidian` npm package is **types-only** — the runtime is provided by the Obsidian app
- **Never bundle** `obsidian`, `electron`, `@codemirror/*`, or `@lezer/*` — they are externals

## File Structure
```
├── src/
│   ├── main.ts          # Plugin entry point (MyPlugin class)
│   └── settings.ts      # Settings interface, defaults, and settings tab
├── esbuild.config.mjs   # Build configuration
├── manifest.json        # Obsidian plugin manifest
├── versions.json        # Version → minAppVersion mapping
├── version-bump.mjs     # Script to sync versions across files
└── main.js              # Build output (gitignored)
```

## Dev Workflow
- Symlink/copy this plugin directory into a vault's `.obsidian/plugins/obsidian-plugin/`
- Run `npm run dev` for live rebuilds
- Use Ctrl+P → "Reload app without saving" in Obsidian to pick up changes

## Conventions
- TypeScript strict mode — no `any` types
- Register all event handlers, commands, and intervals via `this.register*()` / `this.addCommand()` for automatic cleanup on unload
- Settings are loaded in `onload()` and persisted via `this.saveSettings()`
