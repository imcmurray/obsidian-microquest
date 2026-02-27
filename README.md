# MicroQuest

AI-powered goal breakdown into micro-tasks for [Obsidian](https://obsidian.md). Describe a goal in plain language, have a short conversation with Claude to clarify scope and constraints, and get a structured task hierarchy saved as a note in your vault.

## Features

- **Conversational planning** — Claude asks clarifying questions about timeline, budget, skills, and risks before generating tasks
- **Structured task breakdown** — Goals are split into phases, sub-tasks, and actionable micro-tasks with dotted IDs (e.g., `1.2.3`)
- **Task tree sidebar** — Collapsible tree view with progress bar and metadata pills
- **Checkbox sync** — Check off tasks in the sidebar or directly in the note; both stay in sync
- **Regenerate breakdowns** — Redo planning for any existing goal with a single command
- **Goal metadata** — Frontmatter captures budget, timeline, complexity, and summary extracted by Claude

## Requirements

- [Obsidian](https://obsidian.md) v0.15.0 or later
- An [Anthropic API key](https://console.anthropic.com)

## Setup

1. Install the plugin from Obsidian's Community Plugins browser (search "MicroQuest")
2. Enable the plugin in **Settings → Community plugins**
3. Go to **Settings → MicroQuest** and enter your Anthropic API key
4. Click **Test Connection** to verify the key works

## Usage

### Creating a Goal

1. Open the command palette (`Ctrl/Cmd + P`)
2. Run **"MicroQuest: Create new goal"**
3. Describe your goal — be as specific as you can
4. Answer Claude's clarifying questions (or click **Skip Questions** to jump ahead)
5. A structured goal note is created and opened automatically

### Task Tree Sidebar

1. Run **"MicroQuest: Show task tree"** from the command palette
2. The sidebar shows your goal's progress bar, metadata, and collapsible task tree
3. Check off tasks in the sidebar — changes are written back to the note
4. The sidebar updates automatically when you edit checkboxes in the note or switch to a different goal note

### Regenerating a Breakdown

1. Open an existing goal note
2. Run **"MicroQuest: Regenerate task breakdown"**
3. The conversation restarts with your original goal, and the note is overwritten with the new plan

## Settings

| Setting | Description |
|---|---|
| **Anthropic API key** | Your `sk-ant-...` key. Displayed as a password field. |
| **Model** | `claude-sonnet-4-20250514` (recommended) or `claude-haiku-4-5-20251001` (faster, cheaper). |
| **Max planning questions** | How many clarifying questions Claude asks before generating tasks (1–20, default 5). |
| **Note folder** | Where goal notes are saved. Default: `MicroQuest Goals`. |
| **Test Connection** | Verify your API key works. |

## Privacy

Your API key is stored locally in the vault's plugin data (`data.json`) and is never sent anywhere except the Anthropic API. Goal descriptions and conversation messages are sent to the Anthropic Messages API for task generation — no other third-party services are contacted.
