import type { MicroQuestSettings } from "./types";

export const VIEW_TYPE_TASK_TREE = "microquest-task-tree";

export const AVAILABLE_MODELS = [
	"claude-sonnet-4-20250514",
	"claude-haiku-4-5-20251001",
];

export const DEFAULT_SETTINGS: MicroQuestSettings = {
	apiKey: "",
	model: "claude-sonnet-4-20250514",
	maxQuestions: 5,
	noteFolder: "MicroQuest Goals",
};
