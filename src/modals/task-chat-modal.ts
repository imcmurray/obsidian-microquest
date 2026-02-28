import { App, Modal, Notice, TFile, setIcon } from "obsidian";
import { sendMessage } from "../ai/claude-client";
import {
	getTaskChatSystemPrompt,
	getResourceSuggestionPrompt,
} from "../ai/prompts";
import { parseTaskNote } from "../utils/note-parser";
import { generateTaskNoteContent, ensureParentFolders } from "../utils/note-generator";
import type { ConversationMessage, MicroQuestSettings, ChatEntry, TaskNoteMetadata } from "../types";

export class TaskChatModal extends Modal {
	private settings: MicroQuestSettings;
	private taskId: string;
	private taskTitle: string;
	private goalContext: string;
	private taskHierarchy: string;
	private taskNotePath: string;
	private parentGoalPath: string;
	private goalTitle: string;
	private onNoteChange: (() => void) | null;
	private parentFileName: string | undefined;
	private messages: ConversationMessage[] = [];
	private messagesContainer!: HTMLElement;
	private inputArea!: HTMLTextAreaElement;
	private sendBtn!: HTMLButtonElement;
	private resourceBtn!: HTMLButtonElement;
	private isLoading = false;

	constructor(
		app: App,
		settings: MicroQuestSettings,
		taskId: string,
		taskTitle: string,
		goalContext: string,
		taskHierarchy: string,
		taskNotePath: string,
		parentGoalPath: string,
		goalTitle: string,
		onNoteChange?: () => void,
		parentFileName?: string,
	) {
		super(app);
		this.settings = settings;
		this.taskId = taskId;
		this.taskTitle = taskTitle;
		this.goalContext = goalContext;
		this.taskHierarchy = taskHierarchy;
		this.taskNotePath = taskNotePath;
		this.parentGoalPath = parentGoalPath;
		this.goalTitle = goalTitle;
		this.onNoteChange = onNoteChange ?? null;
		this.parentFileName = parentFileName;
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.addClass("microquest-conversation");
		contentEl.addClass("microquest-task-chat");

		const header = contentEl.createDiv({
			cls: "microquest-task-chat-header",
		});
		header.createEl("h2", { text: `Chat: ${this.taskTitle}` });
		header.createEl("p", {
			text: this.taskHierarchy,
			cls: "microquest-task-chat-hierarchy",
		});

		this.messagesContainer = contentEl.createDiv({
			cls: "microquest-messages",
		});

		const inputContainer = contentEl.createDiv({
			cls: "microquest-input-area",
		});
		this.inputArea = inputContainer.createEl("textarea", {
			cls: "microquest-chat-input",
			attr: {
				placeholder: "Ask anything about this task...",
				rows: "3",
			},
		});

		const buttonRow = inputContainer.createDiv({
			cls: "microquest-input-buttons",
		});

		this.resourceBtn = buttonRow.createEl("button", {
			text: "Suggest Resources",
		});
		this.resourceBtn.addEventListener("click", () =>
			this.triggerResourceSuggestion(),
		);

		this.sendBtn = buttonRow.createEl("button", {
			text: "Send",
			cls: "mod-cta",
		});
		this.sendBtn.addEventListener("click", () => this.handleSend());

		this.inputArea.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				this.handleSend();
			}
		});
	}

	async triggerResourceSuggestion(): Promise<void> {
		if (this.isLoading) return;

		const prompt = getResourceSuggestionPrompt(
			this.taskTitle,
			this.goalContext,
		);

		this.addMessageBubble("user", "Suggest resources for this task");
		this.messages.push({ role: "user", content: prompt });

		await this.getAssistantResponse();
	}

	private async handleSend(): Promise<void> {
		if (this.isLoading) return;
		const text = this.inputArea.value.trim();
		if (!text) return;

		this.inputArea.value = "";
		this.addMessageBubble("user", text);
		this.messages.push({ role: "user", content: text });

		await this.getAssistantResponse();
	}

	private async getAssistantResponse(): Promise<void> {
		this.setLoading(true);
		try {
			const systemPrompt = getTaskChatSystemPrompt(
				this.goalContext,
				this.taskId,
				this.taskTitle,
				this.taskHierarchy,
			);
			const response = await sendMessage(
				this.settings.apiKey,
				this.settings.model,
				systemPrompt,
				this.messages,
			);

			this.addMessageBubble("assistant", response);
			this.messages.push({ role: "assistant", content: response });
			this.setLoading(false);
		} catch (e) {
			this.setLoading(false);
			new Notice(
				`MicroQuest: ${e instanceof Error ? e.message : "API error"}`,
			);
		}
	}

	private addMessageBubble(
		role: "user" | "assistant",
		content: string,
	): void {
		const bubble = this.messagesContainer.createDiv({
			cls: `microquest-message microquest-message-${role}`,
		});
		bubble.createDiv({ cls: "microquest-message-content", text: content });

		if (role === "assistant") {
			const pinBtn = bubble.createDiv({ cls: "microquest-pin-btn" });
			setIcon(pinBtn, "pin");
			pinBtn.setAttribute("aria-label", "Pin to task note");
			pinBtn.addEventListener("click", () => this.pinMessage(content, pinBtn));
		}

		this.messagesContainer.scrollTop =
			this.messagesContainer.scrollHeight;
	}

	private async pinMessage(assistantContent: string, pinBtn: HTMLElement): Promise<void> {
		// Find the preceding user message
		let userContent = "";
		for (let i = this.messages.length - 1; i >= 0; i--) {
			if (this.messages[i].role === "assistant" && this.messages[i].content === assistantContent) {
				// Find the user message before this one
				for (let j = i - 1; j >= 0; j--) {
					if (this.messages[j].role === "user") {
						userContent = this.messages[j].content;
						break;
					}
				}
				break;
			}
		}

		if (!userContent) {
			new Notice("MicroQuest: Could not find the user message to pin.");
			return;
		}

		const now = new Date();
		const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

		const entry: ChatEntry = {
			timestamp,
			userMessage: userContent,
			assistantMessage: assistantContent,
		};

		try {
			await this.appendChatEntryToNote(entry);
			pinBtn.empty();
			setIcon(pinBtn, "check");
			pinBtn.addClass("is-pinned");
			new Notice("MicroQuest: Chat pinned to task note.");
			this.onNoteChange?.();
		} catch (e) {
			new Notice(
				`MicroQuest: Failed to pin — ${e instanceof Error ? e.message : "unknown error"}`,
			);
		}
	}

	private async appendChatEntryToNote(entry: ChatEntry): Promise<void> {
		await ensureParentFolders(this.app.vault, this.taskNotePath);

		const existing = this.app.vault.getAbstractFileByPath(this.taskNotePath);
		if (existing instanceof TFile) {
			const content = await this.app.vault.read(existing);
			const taskNote = parseTaskNote(content);
			if (taskNote) {
				taskNote.chatEntries.push(entry);
				const newContent = generateTaskNoteContent(
					taskNote.metadata,
					taskNote.phases,
					taskNote.freeContent || undefined,
					taskNote.chatEntries,
				);
				await this.app.vault.modify(existing, newContent);
			}
		} else {
			// Auto-create task note with just the chat entry
			const metadata: TaskNoteMetadata = {
				parentGoal: this.parentGoalPath,
				goalTitle: this.goalTitle,
				taskId: this.taskId,
				taskTitle: this.taskTitle,
				type: "task-note",
			};
			const newContent = generateTaskNoteContent(metadata, [], undefined, [entry], this.parentFileName);
			await this.app.vault.create(this.taskNotePath, newContent);
		}
	}

	private setLoading(loading: boolean): void {
		this.isLoading = loading;
		this.sendBtn.disabled = loading;
		this.resourceBtn.disabled = loading;
		this.inputArea.disabled = loading;
		if (loading) {
			this.sendBtn.setText("Thinking...");
		} else {
			this.sendBtn.setText("Send");
			this.inputArea.focus();
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
