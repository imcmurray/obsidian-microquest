import { App, Modal, setIcon } from "obsidian";
import { FLAG_CATEGORIES } from "../constants";
import type { FlagCategoryDef } from "../constants";
import type { TaskFlag, TaskFlagType } from "../types";

export class FlagPickerModal extends Modal {
	private currentFlags: TaskFlag[];
	private resolvePromise: (value: TaskFlag[] | null) => void;
	private result: TaskFlag[] | null = null;

	constructor(app: App, currentFlags: TaskFlag[]) {
		super(app);
		this.currentFlags = currentFlags.map((f) => ({ ...f }));
		this.resolvePromise = () => {};
	}

	openAndWait(): Promise<TaskFlag[] | null> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("microquest-flag-picker");

		contentEl.createEl("h3", { text: "Set flags" });

		const categoriesEl = contentEl.createDiv({ cls: "microquest-flag-picker-categories" });

		for (const category of FLAG_CATEGORIES) {
			this.renderCategory(categoriesEl, category);
		}

		const footer = contentEl.createDiv({ cls: "microquest-flag-picker-footer" });

		const clearBtn = footer.createEl("button", { text: "Clear all" });
		clearBtn.addEventListener("click", () => {
			this.currentFlags = [];
			this.result = this.currentFlags;
			this.close();
		});

		const doneBtn = footer.createEl("button", { text: "Done", cls: "mod-cta" });
		doneBtn.addEventListener("click", () => {
			this.result = this.currentFlags;
			this.close();
		});
	}

	private renderCategory(container: HTMLElement, category: FlagCategoryDef): void {
		const row = container.createDiv({ cls: "microquest-flag-picker-row" });

		const labelEl = row.createDiv({ cls: "microquest-flag-picker-label" });
		const iconEl = labelEl.createSpan({ cls: "microquest-flag-picker-icon" });
		setIcon(iconEl, category.icon);
		labelEl.createSpan({ text: category.label });

		const controlEl = row.createDiv({ cls: "microquest-flag-picker-control" });

		if (category.isBoolean) {
			this.renderBooleanToggle(controlEl, category);
		} else if (category.values) {
			this.renderValueButtons(controlEl, category);
		} else if (category.type === "assigned") {
			this.renderTextInput(controlEl, category);
		}
	}

	private renderBooleanToggle(container: HTMLElement, category: FlagCategoryDef): void {
		const existing = this.currentFlags.find((f) => f.type === category.type);
		const toggle = container.createEl("input", {
			type: "checkbox",
			cls: "microquest-flag-picker-toggle",
		});
		toggle.checked = !!existing;

		toggle.addEventListener("change", () => {
			this.removeFlag(category.type);
			if (toggle.checked) {
				this.currentFlags.push({ type: category.type });
			}
		});
	}

	private renderValueButtons(container: HTMLElement, category: FlagCategoryDef): void {
		if (!category.values) return;

		const existing = this.currentFlags.find((f) => f.type === category.type);
		const btnGroup = container.createDiv({ cls: "microquest-flag-picker-btn-group" });

		for (const valueDef of category.values) {
			const btn = btnGroup.createEl("button", {
				text: valueDef.label,
				cls: "microquest-flag-picker-value-btn",
			});
			btn.style.setProperty("--flag-btn-color", valueDef.color);

			if (existing?.value === valueDef.label) {
				btn.addClass("is-active");
			}

			btn.addEventListener("click", () => {
				this.removeFlag(category.type);
				// Deselect if clicking active button
				if (existing?.value === valueDef.label) {
					btnGroup.querySelectorAll(".is-active").forEach((el) => el.removeClass("is-active"));
					// Update existing ref for future clicks
					const idx = this.currentFlags.findIndex((f) => f.type === category.type);
					if (idx !== -1) this.currentFlags.splice(idx, 1);
				} else {
					this.currentFlags.push({ type: category.type, value: valueDef.label });
					btnGroup.querySelectorAll(".is-active").forEach((el) => el.removeClass("is-active"));
					btn.addClass("is-active");
				}
			});
		}
	}

	private renderTextInput(container: HTMLElement, category: FlagCategoryDef): void {
		const existing = this.currentFlags.find((f) => f.type === category.type);
		const input = container.createEl("input", {
			type: "text",
			cls: "microquest-flag-picker-text-input",
			attr: { placeholder: "Name..." },
		});
		if (existing?.value) {
			input.value = existing.value;
		}

		input.addEventListener("change", () => {
			this.removeFlag(category.type);
			const val = input.value.trim();
			if (val) {
				this.currentFlags.push({ type: category.type, value: val });
			}
		});
	}

	private removeFlag(type: TaskFlagType): void {
		this.currentFlags = this.currentFlags.filter((f) => f.type !== type);
	}

	onClose(): void {
		this.contentEl.empty();
		this.resolvePromise(this.result);
	}
}
