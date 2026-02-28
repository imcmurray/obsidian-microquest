export interface MicroQuestSettings {
	apiKey: string;
	model: string;
	maxQuestions: number;
	noteFolder: string;
}

export interface ConversationMessage {
	role: "user" | "assistant";
	content: string;
}

export type TaskFlagType = "difficulty" | "priority" | "assigned" | "needs-info" | "blocked";

export interface TaskFlag {
	type: TaskFlagType;
	value?: string;
}

export interface TaskNode {
	id: string;
	title: string;
	completed: boolean;
	flags: TaskFlag[];
	children: TaskNode[];
}

export interface GoalMetadata {
	goal: string;
	budget?: string;
	timeline?: string;
	complexity?: string;
	summary?: string;
}

export interface ChatEntry {
	timestamp: string;
	userMessage: string;
	assistantMessage: string;
}

export interface GoalNote {
	metadata: GoalMetadata;
	phases: TaskNode[];
}

export interface TaskBreakdownResponse {
	metadata: GoalMetadata;
	phases: TaskNode[];
}

export interface TaskNoteMetadata {
	parentGoal: string;
	goalTitle: string;
	taskId: string;
	taskTitle: string;
	type: "task-note";
}

export interface TaskNote {
	metadata: TaskNoteMetadata;
	phases: TaskNode[];
	freeContent: string;
	chatEntries: ChatEntry[];
}
