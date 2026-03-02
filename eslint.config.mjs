import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
	...obsidianmd.configs.recommended,
	{
		files: ["**/*.ts"],
		languageOptions: {
			parser: tsparser,
			parserOptions: { project: "./tsconfig.json" },
			globals: {
				window: "readonly",
			},
		},
		rules: {
			"obsidianmd/ui/sentence-case": [
				"warn",
				{
					brands: ["MicroQuest", "Claude"],
					acronyms: ["API", "AI", "OK"],
				},
			],
			"@typescript-eslint/no-unsafe-assignment": "off",
		},
	},
]);
