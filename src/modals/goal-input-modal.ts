import { App, Modal } from "obsidian";

export class GoalInputModal extends Modal {
	private resolvePromise: (value: string | null) => void;
	private result: string | null = null;

	constructor(app: App) {
		super(app);
		this.resolvePromise = () => {};
	}

	openAndWait(): Promise<string | null> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("microquest-goal-input");

		contentEl.createEl("h2", { text: "What's your goal?" });
		contentEl.createEl("p", {
			text: "Describe what you want to accomplish. Be as specific as you can.",
			cls: "microquest-goal-description",
		});

		const textarea = contentEl.createEl("textarea", {
			cls: "microquest-goal-textarea",
			attr: {
				placeholder:
					"Build a personal portfolio website with blog...",
				rows: "6",
			},
		});

		const buttonContainer = contentEl.createDiv({
			cls: "microquest-goal-buttons",
		});
		const submitBtn = buttonContainer.createEl("button", {
			text: "Start planning",
			cls: "mod-cta",
		});

		submitBtn.addEventListener("click", () => {
			const value = textarea.value.trim();
			if (value) {
				this.result = value;
				this.close();
			}
		});

		textarea.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
				const value = textarea.value.trim();
				if (value) {
					this.result = value;
					this.close();
				}
			}
		});

		textarea.focus();
	}

	onClose(): void {
		this.contentEl.empty();
		this.resolvePromise(this.result);
	}
}
