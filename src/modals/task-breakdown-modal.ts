import { App, Modal, Notice } from "obsidian";
import { sendMessage } from "../ai/claude-client";
import {
	getTaskBreakdownConversationPrompt,
	getTaskBreakdownGenerationPrompt,
} from "../ai/prompts";
import { parseBody } from "../utils/note-parser";
import type {
	ConversationMessage,
	MicroQuestSettings,
	TaskNode,
} from "../types";

const READY_MARKER = "[READY_TO_GENERATE]";
const MAX_QUESTIONS = 3;

export class TaskBreakdownModal extends Modal {
	private settings: MicroQuestSettings;
	private taskId: string;
	private taskTitle: string;
	private goalContext: string;
	private messages: ConversationMessage[] = [];
	private resolvePromise: (value: TaskNode[] | null) => void;
	private result: TaskNode[] | null = null;
	private messagesContainer!: HTMLElement;
	private inputArea!: HTMLTextAreaElement;
	private sendBtn!: HTMLButtonElement;
	private isLoading = false;

	constructor(
		app: App,
		settings: MicroQuestSettings,
		taskId: string,
		taskTitle: string,
		goalContext: string,
	) {
		super(app);
		this.settings = settings;
		this.taskId = taskId;
		this.taskTitle = taskTitle;
		this.goalContext = goalContext;
		this.resolvePromise = () => {};
	}

	openAndWait(): Promise<TaskNode[] | null> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.addClass("microquest-conversation");

		contentEl.createEl("h2", {
			text: `Breaking down: ${this.taskTitle}`,
		});

		this.messagesContainer = contentEl.createDiv({
			cls: "microquest-messages",
		});

		const inputContainer = contentEl.createDiv({
			cls: "microquest-input-area",
		});
		this.inputArea = inputContainer.createEl("textarea", {
			cls: "microquest-chat-input",
			attr: { placeholder: "Type your answer...", rows: "3" },
		});

		const buttonRow = inputContainer.createDiv({
			cls: "microquest-input-buttons",
		});

		const skipBtn = buttonRow.createEl("button", {
			text: "Skip questions",
		});
		skipBtn.addEventListener("click", () => void this.handleSkip());

		this.sendBtn = buttonRow.createEl("button", {
			text: "Send",
			cls: "mod-cta",
		});
		this.sendBtn.addEventListener("click", () => void this.handleSend());

		this.inputArea.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				void this.handleSend();
			}
		});

		await this.sendInitialMessage();
	}

	private async sendInitialMessage(): Promise<void> {
		const initialMessage = `I want to break down this task into smaller steps: [${this.taskId}] ${this.taskTitle}`;
		this.addMessageBubble("user", initialMessage);
		this.messages.push({ role: "user", content: initialMessage });
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

	private async handleSkip(): Promise<void> {
		if (this.isLoading) return;
		this.addMessageBubble("user", "Skip — generate the breakdown now.");
		this.messages.push({ role: "user", content: "skip" });

		await this.generateBreakdown();
	}

	private async getAssistantResponse(): Promise<void> {
		this.setLoading(true);
		try {
			const systemPrompt = getTaskBreakdownConversationPrompt(
				MAX_QUESTIONS,
				this.goalContext,
				this.taskId,
				this.taskTitle,
			);
			const response = await sendMessage(
				this.settings.apiKey,
				this.settings.model,
				systemPrompt,
				this.messages,
			);

			if (response.includes(READY_MARKER)) {
				this.addMessageBubble(
					"assistant",
					"Got it! Generating sub-task breakdown...",
				);
				this.messages.push({ role: "assistant", content: response });
				await this.generateBreakdown();
			} else {
				this.addMessageBubble("assistant", response);
				this.messages.push({ role: "assistant", content: response });
				this.setLoading(false);
			}
		} catch (e) {
			this.setLoading(false);
			new Notice(
				`${e instanceof Error ? e.message : "API error"}`,
			);
		}
	}

	private async generateBreakdown(): Promise<void> {
		this.setLoading(true);
		try {
			const conversationSummary = this.messages
				.map((m) => `${m.role}: ${m.content}`)
				.join("\n");

			const genMessages: ConversationMessage[] = [
				{
					role: "user",
					content: `Here is the conversation about the task:\n\n${conversationSummary}\n\nPlease generate the sub-task breakdown now.`,
				},
			];

			const response = await sendMessage(
				this.settings.apiKey,
				this.settings.model,
				getTaskBreakdownGenerationPrompt(this.taskId, this.taskTitle),
				genMessages,
			);

			const tasksMatch = response.match(/---TASKS---\s*([\s\S]*?)$/);
			const tasksText = tasksMatch?.[1] ?? response;
			this.result = parseBody(tasksText);
			this.close();
		} catch (e) {
			this.setLoading(false);
			new Notice(
				`${e instanceof Error ? e.message : "Generation failed"}`,
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
		this.messagesContainer.scrollTop =
			this.messagesContainer.scrollHeight;
	}

	private setLoading(loading: boolean): void {
		this.isLoading = loading;
		this.sendBtn.disabled = loading;
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
		this.resolvePromise(this.result);
	}
}
