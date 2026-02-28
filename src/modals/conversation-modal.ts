import { App, Modal, Notice } from "obsidian";
import { sendMessage } from "../ai/claude-client";
import {
	getConversationSystemPrompt,
	GENERATION_SYSTEM_PROMPT,
} from "../ai/prompts";
import { parseTaskBreakdown } from "../ai/parser";
import type {
	ConversationMessage,
	TaskBreakdownResponse,
	MicroQuestSettings,
} from "../types";

const READY_MARKER = "[READY_TO_GENERATE]";

export class ConversationModal extends Modal {
	private settings: MicroQuestSettings;
	private goal: string;
	private messages: ConversationMessage[] = [];
	private resolvePromise: (value: TaskBreakdownResponse | null) => void;
	private result: TaskBreakdownResponse | null = null;
	private messagesContainer!: HTMLElement;
	private inputArea!: HTMLTextAreaElement;
	private sendBtn!: HTMLButtonElement;
	private isLoading = false;

	constructor(app: App, settings: MicroQuestSettings, goal: string) {
		super(app);
		this.settings = settings;
		this.goal = goal;
		this.resolvePromise = () => {};
	}

	openAndWait(): Promise<TaskBreakdownResponse | null> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.addClass("microquest-conversation");

		contentEl.createEl("h2", { text: "Planning your goal..." });

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
		const initialMessage = `My goal: ${this.goal}`;
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
			const systemPrompt = getConversationSystemPrompt(
				this.settings.maxQuestions,
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
					"Great, I have enough information! Generating your task breakdown...",
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
					content: `Here is the planning conversation:\n\n${conversationSummary}\n\nPlease generate the full task breakdown now.`,
				},
			];

			const response = await sendMessage(
				this.settings.apiKey,
				this.settings.model,
				GENERATION_SYSTEM_PROMPT,
				genMessages,
			);

			this.result = parseTaskBreakdown(response);
			if (!this.result.metadata.goal) {
				this.result.metadata.goal = this.goal;
			}
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
