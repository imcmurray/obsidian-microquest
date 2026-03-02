import { ItemView, MarkdownRenderer, Menu, Notice, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import type MicroQuestPlugin from "../main";
import { parseGoalNote, parseTaskNote } from "../utils/note-parser";
import { calculateProgress } from "../utils/progress";
import {
	generateNoteContent,
	generateTaskNoteContent,
	buildIdTaskNotePath,
	buildNestedTaskNotePath,
	ensureParentFolders,
} from "../utils/note-generator";
import { VIEW_TYPE_TASK_TREE, FLAG_CATEGORIES } from "../constants";
import type { GoalNote, TaskNode, TaskNote, TaskNoteMetadata, TaskFlag } from "../types";
import { TaskBreakdownModal } from "../modals/task-breakdown-modal";
import { TaskChatModal } from "../modals/task-chat-modal";
import { FlagPickerModal } from "../modals/flag-picker-modal";

export class TaskTreeView extends ItemView {
	plugin: MicroQuestPlugin;
	private currentFile: TFile | null = null;
	private currentNote: GoalNote | null = null;
	private currentTaskNote: TaskNote | null = null;
	private isWriting = false;

	constructor(leaf: WorkspaceLeaf, plugin: MicroQuestPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_TASK_TREE;
	}

	getDisplayText(): string {
		return "MicroQuest tasks";
	}

	getIcon(): string {
		return "list-checks";
	}

	async refresh(file: TFile | null): Promise<void> {
		if (this.isWriting) return;
		this.currentFile = file;
		this.currentNote = null;
		this.currentTaskNote = null;

		if (file && file.extension === "md") {
			const content = await this.app.vault.read(file);
			const goalNote = parseGoalNote(content);
			if (goalNote) {
				this.currentNote = goalNote;
			} else {
				const taskNote = parseTaskNote(content);
				if (taskNote) {
					this.currentTaskNote = taskNote;
				}
			}
		}

		this.render();
	}

	private render(): void {
		const container = this.containerEl.children[1];
		container.empty();

		if (this.currentTaskNote) {
			this.renderTaskNoteView(container as HTMLElement);
			return;
		}

		if (!this.currentNote) {
			const empty = container.createDiv({
				cls: "microquest-empty-state",
			});
			empty.createEl("p", {
				text: "Open a MicroQuest goal note to view tasks.",
			});
			return;
		}

		const { metadata, phases } = this.currentNote;
		const progress = calculateProgress(phases);

		container.createEl("h3", {
			text: metadata.goal,
			cls: "microquest-tree-title",
		});

		const progressContainer = container.createDiv({
			cls: "microquest-progress",
		});
		const progressBar = progressContainer.createDiv({
			cls: "microquest-progress-bar",
		});
		const progressFill = progressBar.createDiv({
			cls: "microquest-progress-fill",
		});
		progressFill.style.width = `${progress.percentage}%`;
		progressContainer.createEl("span", {
			text: `${progress.completed}/${progress.total} tasks (${progress.percentage}%)`,
			cls: "microquest-progress-text",
		});

		const pills = container.createDiv({ cls: "microquest-pills" });
		if (metadata.timeline) {
			pills.createSpan({
				text: metadata.timeline,
				cls: "microquest-pill",
			});
		}
		if (metadata.budget) {
			pills.createSpan({
				text: metadata.budget,
				cls: "microquest-pill",
			});
		}
		if (metadata.complexity) {
			pills.createSpan({
				text: metadata.complexity,
				cls: "microquest-pill",
			});
		}

		const treeContainer = container.createDiv({ cls: "microquest-tree" });
		this.renderNodes(treeContainer, phases, 0);
	}

	private renderTaskNoteView(container: HTMLElement): void {
		if (!this.currentTaskNote) return;

		const { metadata, phases, freeContent, chatEntries } = this.currentTaskNote;

		// Back link
		const backLink = container.createDiv({ cls: "microquest-back-link" });
		const backAnchor = backLink.createEl("a", {
			cls: "microquest-back-anchor",
			text: "\u2190 back to goal",
		});
		backAnchor.addEventListener("click", () => {
			this.navigateToParentGoal(metadata.parentGoal);
		});

		// Title
		container.createEl("h3", {
			text: `[${metadata.taskId}] ${metadata.taskTitle}`,
			cls: "microquest-tree-title",
		});

		// Free content section
		if (freeContent.trim()) {
			const freeSection = container.createDiv({ cls: "microquest-free-content" });
			const freeBody = freeSection.createDiv({ cls: "microquest-free-content-body" });
			freeBody.setText(freeContent.trim());
		}

		// Pinned chats section
		if (chatEntries.length > 0) {
			const chatsSection = container.createDiv({ cls: "microquest-pinned-chats" });
			const header = chatsSection.createDiv({ cls: "microquest-pinned-chats-header" });
			const toggleArrow = header.createSpan({ cls: "microquest-pinned-chats-toggle", text: "\u25b8" });
			const headerIcon = header.createSpan({ cls: "microquest-pinned-chats-icon" });
			setIcon(headerIcon, "pin");
			header.createSpan({ text: `${chatEntries.length} pinned chat${chatEntries.length === 1 ? "" : "s"}` });

			const chatList = chatsSection.createDiv({ cls: "microquest-pinned-chats-list is-collapsed" });

			const sourcePath = this.currentFile?.path ?? "";
			for (const entry of chatEntries) {
				const entryEl = chatList.createDiv({ cls: "microquest-pinned-chat-entry" });
				entryEl.createDiv({ cls: "microquest-pinned-chat-timestamp", text: entry.timestamp });

				const userMsg = entryEl.createDiv({ cls: "microquest-message microquest-message-user" });
				const userContent = userMsg.createDiv({ cls: "microquest-message-content" });
				void MarkdownRenderer.render(this.app, entry.userMessage, userContent, sourcePath, this);

				const assistantMsg = entryEl.createDiv({ cls: "microquest-message microquest-message-assistant" });
				const assistantContent = assistantMsg.createDiv({ cls: "microquest-message-content" });
				void MarkdownRenderer.render(this.app, entry.assistantMessage, assistantContent, sourcePath, this);
			}

			header.addEventListener("click", () => {
				const collapsed = chatList.hasClass("is-collapsed");
				if (collapsed) {
					chatList.removeClass("is-collapsed");
					toggleArrow.setText("\u25be");
				} else {
					chatList.addClass("is-collapsed");
					toggleArrow.setText("\u25b8");
				}
			});
		}

		// Sub-breakdown
		if (phases.length > 0) {
			const progress = calculateProgress(phases);
			const progressContainer = container.createDiv({
				cls: "microquest-progress",
			});
			const progressBar = progressContainer.createDiv({
				cls: "microquest-progress-bar",
			});
			const progressFill = progressBar.createDiv({
				cls: "microquest-progress-fill",
			});
			progressFill.style.width = `${progress.percentage}%`;
			progressContainer.createEl("span", {
				text: `${progress.completed}/${progress.total} tasks (${progress.percentage}%)`,
				cls: "microquest-progress-text",
			});

			const treeContainer = container.createDiv({
				cls: "microquest-tree",
			});
			this.renderNodes(treeContainer, phases, 0);
		} else if (chatEntries.length === 0 && !freeContent.trim()) {
			const empty = container.createDiv({
				cls: "microquest-empty-state",
			});
			empty.createEl("p", {
				text: 'No sub-breakdown yet. Right-click tasks in the goal view to break them down.',
			});
		}
	}

	private navigateToParentGoal(parentGoalPath: string): void {
		const file = this.app.vault.getAbstractFileByPath(parentGoalPath);
		if (file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf();
			void leaf.openFile(file);
		} else {
			new Notice("Parent goal note not found.");
		}
	}

	private renderNodes(
		container: HTMLElement,
		nodes: TaskNode[],
		depth: number,
	): void {
		for (const node of nodes) {
			const nodeEl = container.createDiv({
				cls: "microquest-tree-node",
			});
			const headerEl = nodeEl.createDiv({
				cls: "microquest-tree-node-header",
			});

			if (node.flags.length > 0) {
				headerEl.addClass("has-flags");
			}

			headerEl.addEventListener("contextmenu", (event) => {
				event.preventDefault();
				event.stopPropagation();
				this.showContextMenu(event, node);
			});

			if (node.children.length > 0) {
				const toggle = headerEl.createSpan({
					cls: "microquest-tree-toggle",
					text: "\u25be",
				});
				const label = headerEl.createSpan({
					text: `${node.id}. ${node.title}`,
					cls: `microquest-tree-label depth-${depth}`,
				});

				this.renderFlagPills(headerEl, node.flags);

				if (this.taskNoteExists(node)) {
					const noteIcon = headerEl.createSpan({
						cls: "microquest-note-icon",
					});
					setIcon(noteIcon, "file-text");
					noteIcon.addEventListener("click", (e) => {
						e.stopPropagation();
						this.openTaskNote(node);
					});
				}

				const childContainer = nodeEl.createDiv({
					cls: "microquest-tree-children",
				});
				this.renderNodes(childContainer, node.children, depth + 1);

				toggle.addEventListener("click", () => {
					const collapsed =
						childContainer.hasClass("is-collapsed");
					if (collapsed) {
						childContainer.removeClass("is-collapsed");
						toggle.setText("\u25be");
					} else {
						childContainer.addClass("is-collapsed");
						toggle.setText("\u25b8");
					}
				});

				label.addEventListener("click", () => {
					const collapsed =
						childContainer.hasClass("is-collapsed");
					if (collapsed) {
						childContainer.removeClass("is-collapsed");
						toggle.setText("\u25be");
					} else {
						childContainer.addClass("is-collapsed");
						toggle.setText("\u25b8");
					}
				});
			} else {
				const checkbox = headerEl.createEl("input", {
					type: "checkbox",
					cls: "microquest-tree-checkbox task-list-item-checkbox",
				});
				checkbox.checked = node.completed;

				const label = headerEl.createSpan({
					text: `${node.id} ${node.title}`,
					cls: `microquest-tree-label depth-${depth}`,
				});
				if (node.completed) {
					label.addClass("is-completed");
				}

				this.renderFlagPills(headerEl, node.flags);

				if (this.taskNoteExists(node)) {
					const noteIcon = headerEl.createSpan({
						cls: "microquest-note-icon",
					});
					setIcon(noteIcon, "file-text");
					noteIcon.addEventListener("click", (e) => {
						e.stopPropagation();
						this.openTaskNote(node);
					});
				}

				checkbox.addEventListener("change", () => {
					node.completed = checkbox.checked;
					if (checkbox.checked) {
						label.addClass("is-completed");
					} else {
						label.removeClass("is-completed");
					}
					void this.writeChangesToFile();
				});
			}
		}
	}

	private renderFlagPills(container: HTMLElement, flags: TaskFlag[]): void {
		if (flags.length === 0) return;

		const flagContainer = container.createSpan({ cls: "microquest-flag-container" });
		for (const flag of flags) {
			const category = FLAG_CATEGORIES.find((c) => c.type === flag.type);
			if (!category) continue;

			let color = category.defaultColor;
			if (flag.value && category.values) {
				const valueDef = category.values.find((v) => v.label === flag.value);
				if (valueDef) color = valueDef.color;
			}

			const pill = flagContainer.createSpan({ cls: "microquest-flag-pill" });
			pill.style.setProperty("--flag-color", color);

			const pillIcon = pill.createSpan({ cls: "microquest-flag-pill-icon" });
			setIcon(pillIcon, category.icon);

			if (flag.value) {
				pill.createSpan({ cls: "microquest-flag-pill-text", text: flag.value });
			}
		}
	}

	private showContextMenu(event: MouseEvent, node: TaskNode): void {
		if (!this.currentNote && !this.currentTaskNote) return;

		const menu = new Menu();

		menu.addItem((item) => {
			item.setTitle("Set flags...")
				.setIcon("tag")
				.onClick(() => void this.openFlagPicker(node));
		});

		menu.addSeparator();

		const hasNote = this.taskNoteExists(node);
		menu.addItem((item) => {
			item.setTitle(hasNote ? "Open task note" : "Create task note")
				.setIcon("file-text")
				.onClick(() => {
					if (hasNote) {
						this.openTaskNote(node);
					} else {
						void this.createTaskNote(node);
					}
				});
		});

		if (this.currentNote) {
			menu.addSeparator();

			menu.addItem((item) => {
				item.setTitle("Break down with AI")
					.setIcon("brain")
					.onClick(() => void this.breakDownTask(node));
			});
		}

		menu.addSeparator();

		menu.addItem((item) => {
			item.setTitle("Ask AI about this")
				.setIcon("message-circle")
				.onClick(() => this.chatAboutTask(node));
		});

		menu.addItem((item) => {
			item.setTitle("Suggest resources")
				.setIcon("link")
				.onClick(() => this.suggestResources(node));
		});

		menu.showAtMouseEvent(event);
	}

	private async openFlagPicker(node: TaskNode): Promise<void> {
		const modal = new FlagPickerModal(this.app, node.flags);
		const result = await modal.openAndWait();
		if (result === null) return;

		node.flags = result;
		this.syncFlagsToMetadataAndWrite();
	}

	private syncFlagsToMetadataAndWrite(): void {
		if (this.currentNote) {
			void this.writeChangesToFile();
		} else if (this.currentTaskNote) {
			void this.writeTaskNoteChangesToFile();
		}
	}

	private getGoalTitle(): string {
		return this.currentNote?.metadata.goal
			?? this.currentTaskNote?.metadata.goalTitle
			?? "";
	}

	private getTaskNotePath(node: TaskNode): string {
		if (this.currentTaskNote && this.currentFile) {
			return buildNestedTaskNotePath(
				this.currentFile.path,
				this.currentTaskNote.metadata.taskId,
				this.currentTaskNote.metadata.taskTitle,
				node.id,
				node.title,
			);
		}
		return buildIdTaskNotePath(
			this.plugin.settings.noteFolder,
			this.getGoalTitle(),
			node.id,
			node.title,
			this.currentNote?.phases ?? [],
		);
	}

	private taskNoteExists(node: TaskNode): boolean {
		const path = this.getTaskNotePath(node);
		return this.app.vault.getAbstractFileByPath(path) instanceof TFile;
	}

	private async createTaskNote(node: TaskNode): Promise<void> {
		if (!this.currentFile) return;

		const metadata: TaskNoteMetadata = {
			parentGoal: this.currentNote
				? this.currentFile.path
				: this.currentTaskNote?.metadata.parentGoal ?? this.currentFile.path,
			goalTitle: this.getGoalTitle(),
			taskId: node.id,
			taskTitle: node.title,
			type: "task-note",
		};

		const parentFileName = this.currentTaskNote
			? this.currentFile.basename
			: undefined;
		const content = generateTaskNoteContent(metadata, [], undefined, undefined, parentFileName);

		const path = this.getTaskNotePath(node);
		await ensureParentFolders(this.app.vault, path);

		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) {
			const leaf = this.app.workspace.getLeaf();
			await leaf.openFile(existing);
			return;
		}

		const file = await this.app.vault.create(path, content);
		const leaf = this.app.workspace.getLeaf();
		await leaf.openFile(file);

		this.render();
	}

	private openTaskNote(node: TaskNode): void {
		const path = this.getTaskNotePath(node);
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf();
			void leaf.openFile(file);
		} else {
			new Notice("Task note not found.");
		}
	}

	private async breakDownTask(node: TaskNode): Promise<void> {
		if (!this.plugin.settings.apiKey) {
			new Notice("Please set your API key in settings.");
			return;
		}

		const goalContext = this.currentNote?.metadata.goal ?? this.currentTaskNote?.metadata.taskTitle ?? "";

		const modal = new TaskBreakdownModal(
			this.app,
			this.plugin.settings,
			node.id,
			node.title,
			goalContext,
		);

		const result = await modal.openAndWait();
		if (!result || result.length === 0) return;

		if (!this.currentFile) return;

		const metadata: TaskNoteMetadata = {
			parentGoal: this.currentNote
				? this.currentFile.path
				: this.currentTaskNote?.metadata.parentGoal ?? this.currentFile.path,
			goalTitle: this.getGoalTitle(),
			taskId: node.id,
			taskTitle: node.title,
			type: "task-note",
		};

		const parentFileName = this.currentTaskNote
			? this.currentFile.basename
			: undefined;
		const content = generateTaskNoteContent(metadata, result, undefined, undefined, parentFileName);

		const path = this.getTaskNotePath(node);
		await ensureParentFolders(this.app.vault, path);
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) {
			await this.app.vault.modify(existing, content);
			const leaf = this.app.workspace.getLeaf();
			await leaf.openFile(existing);
		} else {
			const file = await this.app.vault.create(path, content);
			const leaf = this.app.workspace.getLeaf();
			await leaf.openFile(file);
		}

		this.render();
	}

	private chatAboutTask(node: TaskNode): void {
		if (!this.plugin.settings.apiKey) {
			new Notice("Please set your API key in settings.");
			return;
		}

		const goalContext = this.currentNote?.metadata.goal ?? this.currentTaskNote?.metadata.taskTitle ?? "";
		const hierarchy = this.buildTaskHierarchy(node);
		const taskNotePath = this.getTaskNotePath(node);
		const parentGoalPath = this.currentNote
			? (this.currentFile?.path ?? "")
			: (this.currentTaskNote?.metadata.parentGoal ?? this.currentFile?.path ?? "");
		const parentFileName = this.currentTaskNote && this.currentFile
			? this.currentFile.basename
			: undefined;

		const modal = new TaskChatModal(
			this.app,
			this.plugin.settings,
			node.id,
			node.title,
			goalContext,
			hierarchy,
			taskNotePath,
			parentGoalPath,
			this.getGoalTitle(),
			() => this.render(),
			parentFileName,
		);

		modal.open();
	}

	private suggestResources(node: TaskNode): void {
		if (!this.plugin.settings.apiKey) {
			new Notice("Please set your API key in settings.");
			return;
		}

		const goalContext = this.currentNote?.metadata.goal ?? this.currentTaskNote?.metadata.taskTitle ?? "";
		const hierarchy = this.buildTaskHierarchy(node);
		const taskNotePath = this.getTaskNotePath(node);
		const parentGoalPath = this.currentNote
			? (this.currentFile?.path ?? "")
			: (this.currentTaskNote?.metadata.parentGoal ?? this.currentFile?.path ?? "");
		const parentFileName = this.currentTaskNote && this.currentFile
			? this.currentFile.basename
			: undefined;

		const modal = new TaskChatModal(
			this.app,
			this.plugin.settings,
			node.id,
			node.title,
			goalContext,
			hierarchy,
			taskNotePath,
			parentGoalPath,
			this.getGoalTitle(),
			() => this.render(),
			parentFileName,
		);

		modal.open();
		void modal.triggerResourceSuggestion();
	}

	private buildTaskHierarchy(targetNode: TaskNode): string {
		const phases = this.currentNote?.phases ?? this.currentTaskNote?.phases ?? [];
		const path: string[] = [];
		this.findNodePath(phases, targetNode.id, path);
		return path.join(" > ");
	}

	private findNodePath(
		nodes: TaskNode[],
		targetId: string,
		path: string[],
	): boolean {
		for (const node of nodes) {
			path.push(`${node.id} ${node.title}`);
			if (node.id === targetId) return true;
			if (
				node.children.length > 0 &&
				this.findNodePath(node.children, targetId, path)
			) {
				return true;
			}
			path.pop();
		}
		return false;
	}

	private async writeTaskNoteChangesToFile(): Promise<void> {
		if (!this.currentFile || !this.currentTaskNote) return;
		this.isWriting = true;
		try {
			this.updateParentCompletion(this.currentTaskNote.phases);
			const content = generateTaskNoteContent(
				this.currentTaskNote.metadata,
				this.currentTaskNote.phases,
				this.currentTaskNote.freeContent || undefined,
				this.currentTaskNote.chatEntries.length > 0 ? this.currentTaskNote.chatEntries : undefined,
			);
			await this.app.vault.modify(this.currentFile, content);
			this.render();
		} finally {
			this.isWriting = false;
		}
	}

	private async writeChangesToFile(): Promise<void> {
		if (!this.currentFile || !this.currentNote) return;
		this.isWriting = true;
		try {
			this.updateParentCompletion(this.currentNote.phases);
			const content = generateNoteContent(
				this.currentNote.metadata,
				this.currentNote.phases,
			);
			await this.app.vault.modify(this.currentFile, content);
			this.render();
		} finally {
			this.isWriting = false;
		}
	}

	private updateParentCompletion(nodes: TaskNode[]): void {
		for (const node of nodes) {
			if (node.children.length > 0) {
				this.updateParentCompletion(node.children);
				node.completed = node.children.every((c) => c.completed);
			}
		}
	}

	async onOpen(): Promise<void> {
		this.render();
	}

	async onClose(): Promise<void> {
		this.currentFile = null;
		this.currentNote = null;
		this.currentTaskNote = null;
	}
}
