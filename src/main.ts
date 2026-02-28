import { Notice, Plugin, TFile } from "obsidian";
import { MicroQuestSettingTab } from "./settings";
import { DEFAULT_SETTINGS, VIEW_TYPE_TASK_TREE } from "./constants";
import { GoalInputModal } from "./modals/goal-input-modal";
import { ConversationModal } from "./modals/conversation-modal";
import { TaskTreeView } from "./views/task-tree-view";
import { generateNoteContent, buildNotePath, buildGoalFolderPath } from "./utils/note-generator";
import { parseGoalNote } from "./utils/note-parser";
import type { MicroQuestSettings } from "./types";

export default class MicroQuestPlugin extends Plugin {
	settings: MicroQuestSettings = DEFAULT_SETTINGS;
	private debounceTimer: number | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new MicroQuestSettingTab(this.app, this));

		this.registerView(
			VIEW_TYPE_TASK_TREE,
			(leaf) => new TaskTreeView(leaf, this),
		);

		this.addCommand({
			id: "create-new-goal",
			name: "Create new goal",
			callback: () => this.createNewGoal(),
		});

		this.addCommand({
			id: "regenerate-breakdown",
			name: "Regenerate task breakdown",
			checkCallback: (checking: boolean) => {
				const file = this.app.workspace.getActiveFile();
				if (!file) return false;
				const cache = this.app.metadataCache.getFileCache(file);
				if (!cache?.frontmatter?.["goal"]) return false;
				if (checking) return true;
				void this.regenerateBreakdown(file);
				return true;
			},
		});

		this.addCommand({
			id: "show-task-tree",
			name: "Show task tree",
			callback: () => this.activateView(),
		});

		this.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				this.refreshSidebar(file);
			}),
		);

		this.registerEvent(
			this.app.vault.on("modify", (file) => {
				if (file instanceof TFile) {
					this.debouncedRefreshSidebar(file);
				}
			}),
		);

		this.app.workspace.onLayoutReady(async () => {
			await this.activateView();
			const activeFile = this.app.workspace.getActiveFile();
			this.refreshSidebar(activeFile);
		});
	}

	onunload(): void {
		if (this.debounceTimer !== null) {
			window.clearTimeout(this.debounceTimer);
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async createNewGoal(): Promise<void> {
		if (!this.settings.apiKey) {
			new Notice("Please set your API key in settings.");
			return;
		}

		const goalModal = new GoalInputModal(this.app);
		const goal = await goalModal.openAndWait();
		if (!goal) return;

		const convModal = new ConversationModal(
			this.app,
			this.settings,
			goal,
		);
		const result = await convModal.openAndWait();
		if (!result) return;

		const notePath = buildNotePath(
			this.settings.noteFolder,
			result.metadata.goal || goal,
		);
		const content = generateNoteContent(result.metadata, result.phases);

		const folder = this.settings.noteFolder;
		if (!this.app.vault.getAbstractFileByPath(folder)) {
			await this.app.vault.createFolder(folder);
		}
		const goalFolder = buildGoalFolderPath(folder, result.metadata.goal || goal);
		if (!this.app.vault.getAbstractFileByPath(goalFolder)) {
			await this.app.vault.createFolder(goalFolder);
		}

		const file = await this.app.vault.create(notePath, content);
		const leaf = this.app.workspace.getLeaf();
		await leaf.openFile(file);
		await this.activateView();
	}

	private async regenerateBreakdown(file: TFile): Promise<void> {
		if (!this.settings.apiKey) {
			new Notice("Please set your API key in settings.");
			return;
		}

		const content = await this.app.vault.read(file);
		const note = parseGoalNote(content);
		if (!note) {
			new Notice("Could not parse goal note.");
			return;
		}

		const convModal = new ConversationModal(
			this.app,
			this.settings,
			note.metadata.goal,
		);
		const result = await convModal.openAndWait();
		if (!result) return;

		const newContent = generateNoteContent(result.metadata, result.phases);
		await this.app.vault.modify(file, newContent);
		new Notice("Task breakdown regenerated.");
	}

	private async activateView(): Promise<void> {
		const existing =
			this.app.workspace.getLeavesOfType(VIEW_TYPE_TASK_TREE);
		if (existing.length > 0) {
			void this.app.workspace.revealLeaf(existing[0]);
			return;
		}

		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({
				type: VIEW_TYPE_TASK_TREE,
				active: true,
			});
			void this.app.workspace.revealLeaf(leaf);
		}
	}

	private refreshSidebar(file: TFile | null): void {
		const leaves =
			this.app.workspace.getLeavesOfType(VIEW_TYPE_TASK_TREE);
		for (const leaf of leaves) {
			const view = leaf.view as TaskTreeView;
			void view.refresh(file);
		}
	}

	private debouncedRefreshSidebar(file: TFile): void {
		if (this.debounceTimer !== null) {
			window.clearTimeout(this.debounceTimer);
		}
		this.debounceTimer = window.setTimeout(() => {
			this.refreshSidebar(file);
			this.debounceTimer = null;
		}, 300);
	}
}
