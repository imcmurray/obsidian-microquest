import { App, PluginSettingTab, Setting } from "obsidian";
import type MyPlugin from "./main";

export interface MyPluginSettings {
	exampleSetting: string;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	exampleSetting: "default",
};

export class MyPluginSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Example setting")
			.setDesc("A placeholder setting.")
			.addText((text) =>
				text
					.setPlaceholder("Enter a value")
					.setValue(this.plugin.settings.exampleSetting)
					.onChange(async (value) => {
						this.plugin.settings.exampleSetting = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
