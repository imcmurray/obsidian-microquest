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

export interface TaskNode {
	id: string;
	title: string;
	completed: boolean;
	children: TaskNode[];
}

export interface GoalMetadata {
	goal: string;
	budget?: string;
	timeline?: string;
	complexity?: string;
	summary?: string;
}

export interface GoalNote {
	metadata: GoalMetadata;
	phases: TaskNode[];
}

export interface TaskBreakdownResponse {
	metadata: GoalMetadata;
	phases: TaskNode[];
}
