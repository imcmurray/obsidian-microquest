# MicroQuest — Obsidian Plugin

## Build Commands
- `npm run dev` — Start esbuild in watch mode (auto-rebuilds on file changes)
- `npm run build` — Production build (runs tsc type-check then esbuild with minification)

## Architecture
- esbuild bundles `src/main.ts` → `main.js` (CommonJS, ES2018 target)
- The `obsidian` npm package is **types-only** — the runtime is provided by the Obsidian app
- **Never bundle** `obsidian`, `electron`, `@codemirror/*`, or `@lezer/*` — they are externals
- Uses Obsidian's `requestUrl()` to call the Anthropic Messages API directly (no SDK dependency)

## File Structure
```
├── src/
│   ├── main.ts                     # Plugin entry: commands, views, event wiring
│   ├── settings.ts                 # Settings tab (API key, model, max questions, folder)
│   ├── types.ts                    # Shared interfaces (GoalMetadata, TaskNode, etc.)
│   ├── constants.ts                # View type ID, model list, default settings
│   ├── ai/
│   │   ├── claude-client.ts        # requestUrl wrapper for Anthropic Messages API
│   │   ├── prompts.ts              # System prompts (conversation + generation phases)
│   │   └── parser.ts               # Parse structured AI output → TaskNode tree
│   ├── modals/
│   │   ├── goal-input-modal.ts     # Simple modal: goal description textarea
│   │   └── conversation-modal.ts   # Chat-style modal: multi-turn Q&A with Claude
│   ├── views/
│   │   └── task-tree-view.ts       # Sidebar ItemView: task tree + progress bar
│   └── utils/
│       ├── note-generator.ts       # Build frontmatter + markdown from GoalNote
│       ├── note-parser.ts          # Parse existing goal note → GoalNote
│       └── progress.ts             # Calculate completion percentage from task tree
├── styles.css              # Plugin CSS (loaded automatically by Obsidian)
├── esbuild.config.mjs      # Build configuration
├── manifest.json            # Obsidian plugin manifest (id: microquest)
├── versions.json            # Version → minAppVersion mapping
├── version-bump.mjs         # Script to sync versions across files
└── main.js                  # Build output (gitignored)
```

## Dev Workflow
- Symlink/copy this plugin directory into a vault's `.obsidian/plugins/microquest/`
- Run `npm run dev` for live rebuilds
- Use Ctrl+P → "Reload app without saving" in Obsidian to pick up changes

## Conventions
- TypeScript strict mode — no `any` types
- Register all event handlers, commands, and intervals via `this.register*()` / `this.addCommand()` for automatic cleanup on unload
- Settings are loaded in `onload()` and persisted via `this.saveSettings()`
- AI task output uses `---METADATA---` / `---TASKS---` delimiters with `## Phase` / `### Sub-task` / `- [ ] micro-task` structure
- Sidebar view uses `isWriting` flag to prevent infinite re-render loops from self-triggered vault modifications
