import type { MicroQuestSettings, TaskFlagType } from "./types";

export const VIEW_TYPE_TASK_TREE = "microquest-task-tree";

export const AVAILABLE_MODELS = [
	"claude-sonnet-4-20250514",
	"claude-haiku-4-5-20251001",
];

export const TASK_NOTE_TYPE = "task-note";

export const DEFAULT_SETTINGS: MicroQuestSettings = {
	apiKey: "",
	model: "claude-sonnet-4-20250514",
	maxQuestions: 5,
	noteFolder: "MicroQuest Goals",
};

export interface FlagValueDef {
	label: string;
	color: string;
}

export interface FlagCategoryDef {
	type: TaskFlagType;
	label: string;
	icon: string;
	isBoolean: boolean;
	values?: FlagValueDef[];
	defaultColor: string;
}

export const FLAG_CATEGORIES: FlagCategoryDef[] = [
	{
		type: "difficulty",
		label: "Difficulty",
		icon: "gauge",
		isBoolean: false,
		defaultColor: "#8b5cf6",
		values: [
			{ label: "easy", color: "#22c55e" },
			{ label: "medium", color: "#eab308" },
			{ label: "hard", color: "#ef4444" },
		],
	},
	{
		type: "priority",
		label: "Priority",
		icon: "alert-triangle",
		isBoolean: false,
		defaultColor: "#f97316",
		values: [
			{ label: "low", color: "#6b7280" },
			{ label: "medium", color: "#3b82f6" },
			{ label: "high", color: "#f97316" },
			{ label: "urgent", color: "#ef4444" },
		],
	},
	{
		type: "assigned",
		label: "Assigned",
		icon: "user",
		isBoolean: false,
		defaultColor: "#3b82f6",
	},
	{
		type: "needs-info",
		label: "Needs Info",
		icon: "help-circle",
		isBoolean: true,
		defaultColor: "#a855f7",
	},
	{
		type: "blocked",
		label: "Blocked",
		icon: "circle-off",
		isBoolean: true,
		defaultColor: "#ef4444",
	},
];
