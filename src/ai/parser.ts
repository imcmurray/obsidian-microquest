import type { GoalMetadata, TaskNode, TaskBreakdownResponse } from "../types";

export function parseTaskBreakdown(text: string): TaskBreakdownResponse {
	const metadataMatch = text.match(
		/---METADATA---\s*([\s\S]*?)\s*---TASKS---/,
	);
	const tasksMatch = text.match(/---TASKS---\s*([\s\S]*?)$/);

	const metadata = parseMetadata(metadataMatch?.[1] ?? "");
	const phases = parseTasks(tasksMatch?.[1] ?? "");

	return { metadata, phases };
}

function parseMetadata(text: string): GoalMetadata {
	const data: Record<string, string> = {};
	for (const line of text.split("\n")) {
		const match = line.match(/^(\w+):\s*(.+)$/);
		if (match) {
			data[match[1]] = match[2].trim();
		}
	}
	return {
		goal: data["goal"] ?? "",
		budget: data["budget"],
		timeline: data["timeline"],
		complexity: data["complexity"],
		summary: data["summary"],
	};
}

function parseTasks(text: string): TaskNode[] {
	const phases: TaskNode[] = [];
	let currentPhase: TaskNode | null = null;
	let currentSubTask: TaskNode | null = null;

	for (const line of text.split("\n")) {
		const phaseMatch = line.match(/^##\s+(\d+[\d.]*)\.\s+(.+)$/);
		if (phaseMatch) {
			currentPhase = {
				id: phaseMatch[1],
				title: phaseMatch[2].trim(),
				completed: false,
				children: [],
			};
			phases.push(currentPhase);
			currentSubTask = null;
			continue;
		}

		const subTaskMatch = line.match(/^###\s+(\d+[\d.]*)\s+(.+)$/);
		if (subTaskMatch && currentPhase) {
			currentSubTask = {
				id: subTaskMatch[1],
				title: subTaskMatch[2].trim(),
				completed: false,
				children: [],
			};
			currentPhase.children.push(currentSubTask);
			continue;
		}

		const microTaskMatch = line.match(
			/^-\s+\[([ x])\]\s+(\d+[\d.]*)\s+(.+)$/,
		);
		if (microTaskMatch) {
			const task: TaskNode = {
				id: microTaskMatch[2],
				title: microTaskMatch[3].trim(),
				completed: microTaskMatch[1] === "x",
				children: [],
			};
			if (currentSubTask) {
				currentSubTask.children.push(task);
			} else if (currentPhase) {
				currentPhase.children.push(task);
			}
		}
	}

	return phases;
}
