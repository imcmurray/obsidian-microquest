# MicroQuest — Testing & Usage Guide

## Installing into Obsidian for Development

### Prerequisites
- [Obsidian](https://obsidian.md) v0.15.0 or later
- Node.js 18+
- An Anthropic API key (get one at https://console.anthropic.com)

### Step 1: Build the plugin

```bash
cd /path/to/obsidian-plugin
npm install
npm run build
```

This produces `main.js` in the project root. For live-reloading during development, use `npm run dev` instead — it watches for file changes and rebuilds automatically.

### Step 2: Link into your vault

Obsidian loads plugins from `<vault>/.obsidian/plugins/<plugin-id>/`. The plugin needs three files: `main.js`, `manifest.json`, and `styles.css`.

**Option A — Symlink (recommended for development):**

```bash
# Linux / macOS
ln -s /path/to/obsidian-plugin /path/to/your-vault/.obsidian/plugins/microquest

# Windows (run as Administrator)
mklink /D "C:\path\to\your-vault\.obsidian\plugins\microquest" "C:\path\to\obsidian-plugin"
```

**Option B — Copy files manually:**

```bash
mkdir -p /path/to/your-vault/.obsidian/plugins/microquest
cp main.js manifest.json styles.css /path/to/your-vault/.obsidian/plugins/microquest/
```

You'll need to re-copy after each build if you use this approach.

### Step 3: Enable the plugin in Obsidian

1. Open Obsidian and your vault
2. Go to **Settings → Community plugins**
3. If prompted, click **Turn on community plugins**
4. You should see **MicroQuest** in the installed plugins list
5. Toggle it **on**

If it doesn't appear, try **Settings → Community plugins → Reload plugins** (the refresh icon), or restart Obsidian entirely.

### Step 4: Reloading after changes

When you make code changes (with `npm run dev` running):

1. Press `Ctrl+P` (or `Cmd+P` on macOS) to open the command palette
2. Search for **"Reload app without saving"** and select it
3. Obsidian restarts and loads the updated plugin

Alternatively, you can toggle the plugin off and on in Settings → Community plugins.

---

## Configuring the Plugin

Open **Settings → MicroQuest** to configure:

| Setting | Description |
|---|---|
| **Anthropic API key** | Your `sk-ant-...` key. Stored locally in the vault's plugin data, never sent anywhere except the Anthropic API. Displayed as a password field. |
| **Model** | Choose between `claude-sonnet-4-20250514` (recommended, balanced) and `claude-haiku-4-5-20251001` (faster, cheaper). |
| **Max planning questions** | How many clarifying questions Claude will ask before generating tasks (1–20). Default is 5. Lower values = faster workflow, higher = more thorough plans. |
| **Note folder** | Where goal notes are saved. Default: `MicroQuest Goals`. Created automatically on first use. |
| **Test Connection** | Click to verify your API key works. Shows a success/failure notice. |

**Start here:** Enter your API key and click **Test Connection** to make sure everything works before creating your first goal.

---

## Using the Plugin

### Creating a New Goal

1. Open the command palette (`Ctrl/Cmd + P`)
2. Search for **"MicroQuest: Create new goal"**
3. A modal appears asking you to describe your goal — be as specific as you can
   - Example: *"Build a personal portfolio website with a blog, project showcase, and contact form"*
   - Press **Start Planning** or `Ctrl/Cmd + Enter` to submit

4. A **conversation modal** opens where Claude asks clarifying questions one at a time:
   - Answer each question to help Claude understand your constraints (budget, timeline, skills, risks, etc.)
   - Press **Send** or `Ctrl/Cmd + Enter` after each answer
   - Click **Skip Questions** at any time to jump straight to task generation
   - Claude will automatically stop asking after the configured max questions

5. Once Claude has enough info, it generates a structured task breakdown. A new note is created and opened automatically.

### Understanding the Generated Note

The note has two parts:

**Frontmatter** (YAML metadata at the top):
```yaml
---
goal: "Build a personal portfolio website"
budget: "$500"
timeline: "2 weeks"
complexity: "Medium"
summary: "A responsive portfolio site with blog, projects, and contact form"
---
```

**Task hierarchy** (markdown body):
```markdown
## 1. Setup & Planning

### 1.1 Environment Setup
- [ ] 1.1.1 Install Node.js and set up development environment
- [ ] 1.1.2 Initialize Next.js project with TypeScript
- [ ] 1.1.3 Set up Git repository and initial commit

### 1.2 Design Planning
- [ ] 1.2.1 Create wireframes for all pages
- [ ] 1.2.2 Choose color palette and typography
```

Each task has a dotted ID (e.g., `1.2.3`) for easy reference. Phases (`##`) contain sub-tasks (`###`), which contain micro-tasks (`- [ ]`).

### Using the Task Tree Sidebar

1. Open the command palette and search for **"MicroQuest: Show task tree"**
2. A sidebar panel opens on the right showing:
   - **Goal title** at the top
   - **Progress bar** with completion percentage (e.g., "3/24 tasks (12%)")
   - **Metadata pills** showing timeline, budget, and complexity
   - **Collapsible task tree** mirroring the note structure

3. **Check off tasks** by clicking checkboxes in the sidebar — changes are written back to the note file automatically
4. **Collapse/expand** phases and sub-tasks by clicking the triangle toggle
5. The sidebar updates automatically when you:
   - Open a different goal note
   - Edit checkboxes directly in the note

You can also check off tasks directly in the note using Obsidian's native checkbox support — the sidebar stays in sync.

### Regenerating a Task Breakdown

If you want to redo the planning for an existing goal:

1. Open the goal note
2. Open the command palette and search for **"MicroQuest: Regenerate task breakdown"**
   - This command only appears when the active file has a `goal` field in its frontmatter
3. The conversation modal opens again with the original goal
4. Answer questions or skip, and the note is overwritten with the new breakdown

**Note:** This replaces the entire note content including any checked tasks. Consider duplicating the note first if you want to preserve progress.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Plugin doesn't appear in Settings | Make sure `main.js`, `manifest.json`, and `styles.css` are all in the plugin folder. Restart Obsidian. |
| "Please set your API key" notice | Go to Settings → MicroQuest and enter your Anthropic API key. |
| API errors (401) | Your API key is invalid or expired. Generate a new one at console.anthropic.com. |
| API errors (429) | Rate limited. Wait a moment and try again, or check your Anthropic usage limits. |
| API errors (500+) | Anthropic service issue. Try again in a few minutes. |
| Sidebar shows "Open a MicroQuest goal note" | The currently active file either isn't a markdown file or doesn't have a `goal` field in its frontmatter. Open a goal note generated by MicroQuest. |
| Checkbox changes in sidebar not saving | Check the developer console (`Ctrl+Shift+I`) for errors. The vault may be read-only. |
| Tasks not parsing correctly | Ensure the note follows the expected format — `## Phase`, `### Sub-task`, `- [ ] id Task`. Manual edits that break this structure will cause parsing issues. |

### Viewing Logs

Open the developer console in Obsidian with `Ctrl+Shift+I` (or `Cmd+Option+I` on macOS) to see any errors or API response details.
