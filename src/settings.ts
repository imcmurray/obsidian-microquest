import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type MicroQuestPlugin from "./main";
import { AVAILABLE_MODELS } from "./constants";
import { sendMessage } from "./ai/claude-client";

export class MicroQuestSettingTab extends PluginSettingTab {
	plugin: MicroQuestPlugin;

	constructor(app: App, plugin: MicroQuestPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Anthropic API key")
			.setDesc("Your Claude API key, stored locally.")
			.addText((text) => {
				text.inputEl.type = "password";
				text.setPlaceholder("Enter your API key")
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Model")
			.setDesc("Claude model to use for task generation.")
			.addDropdown((dropdown) => {
				for (const model of AVAILABLE_MODELS) {
					dropdown.addOption(model, model);
				}
				dropdown
					.setValue(this.plugin.settings.model)
					.onChange(async (value) => {
						this.plugin.settings.model = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Max planning questions")
			.setDesc(
				"Maximum clarifying questions Claude will ask (1-20).",
			)
			.addSlider((slider) =>
				slider
					.setLimits(1, 20, 1)
					.setValue(this.plugin.settings.maxQuestions)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.maxQuestions = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Note folder")
			.setDesc("Folder where goal notes will be created.")
			.addText((text) =>
				text
					.setPlaceholder("MicroQuest goals")
					.setValue(this.plugin.settings.noteFolder)
					.onChange(async (value) => {
						this.plugin.settings.noteFolder = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Test API connection")
			.setDesc("Verify your API key works.")
			.addButton((btn) =>
				btn.setButtonText("Test connection").onClick(async () => {
					if (!this.plugin.settings.apiKey) {
						new Notice("Please enter an API key first.");
						return;
					}
					btn.setButtonText("Testing...");
					btn.setDisabled(true);
					try {
						await sendMessage(
							this.plugin.settings.apiKey,
							this.plugin.settings.model,
							"Respond with exactly: OK",
							[{ role: "user", content: "Test connection." }],
						);
						new Notice("API connection successful!");
					} catch (e) {
						new Notice(
							`Connection failed — ${e instanceof Error ? e.message : "Unknown error"}`,
						);
					} finally {
						btn.setButtonText("Test connection");
						btn.setDisabled(false);
					}
				}),
			);
	}
}
