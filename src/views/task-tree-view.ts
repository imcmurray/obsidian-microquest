import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import type MicroQuestPlugin from "../main";
import { parseGoalNote } from "../utils/note-parser";
import { calculateProgress } from "../utils/progress";
import { generateNoteContent } from "../utils/note-generator";
import { VIEW_TYPE_TASK_TREE } from "../constants";
import type { GoalNote, TaskNode } from "../types";

export class TaskTreeView extends ItemView {
	plugin: MicroQuestPlugin;
	private currentFile: TFile | null = null;
	private currentNote: GoalNote | null = null;
	private isWriting = false;

	constructor(leaf: WorkspaceLeaf, plugin: MicroQuestPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_TASK_TREE;
	}

	getDisplayText(): string {
		return "MicroQuest Tasks";
	}

	getIcon(): string {
		return "list-checks";
	}

	async refresh(file: TFile | null): Promise<void> {
		if (this.isWriting) return;
		this.currentFile = file;
		this.currentNote = null;

		if (file && file.extension === "md") {
			const content = await this.app.vault.read(file);
			this.currentNote = parseGoalNote(content);
		}

		this.render();
	}

	private render(): void {
		const container = this.containerEl.children[1];
		container.empty();

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

			if (node.children.length > 0) {
				const toggle = headerEl.createSpan({
					cls: "microquest-tree-toggle",
					text: "\u25be",
				});
				headerEl.createSpan({
					text: `${node.id}. ${node.title}`,
					cls: `microquest-tree-label depth-${depth}`,
				});

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
			} else {
				const checkbox = headerEl.createEl("input", {
					type: "checkbox",
					cls: "microquest-tree-checkbox task-list-item-checkbox",
				}) as HTMLInputElement;
				checkbox.checked = node.completed;

				const label = headerEl.createSpan({
					text: `${node.id} ${node.title}`,
					cls: `microquest-tree-label depth-${depth}`,
				});
				if (node.completed) {
					label.addClass("is-completed");
				}

				checkbox.addEventListener("change", () => {
					node.completed = checkbox.checked;
					if (checkbox.checked) {
						label.addClass("is-completed");
					} else {
						label.removeClass("is-completed");
					}
					this.writeChangesToFile();
				});
			}
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
	}
}
