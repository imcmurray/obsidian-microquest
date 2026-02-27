import type { GoalNote, GoalMetadata, TaskNode } from "../types";

export function parseGoalNote(content: string): GoalNote | null {
	const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!fmMatch) return null;

	const metadata = parseFrontmatter(fmMatch[1]);
	if (!metadata.goal) return null;

	const body = content.slice(fmMatch[0].length);
	const phases = parseBody(body);
	updateParentCompletion(phases);

	return { metadata, phases };
}

function parseFrontmatter(text: string): GoalMetadata {
	const data: Record<string, string> = {};
	for (const line of text.split("\n")) {
		const match = line.match(/^(\w+):\s*"?(.*?)"?\s*$/);
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

function parseBody(text: string): TaskNode[] {
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

function updateParentCompletion(nodes: TaskNode[]): void {
	for (const node of nodes) {
		if (node.children.length > 0) {
			updateParentCompletion(node.children);
			node.completed = node.children.every((c) => c.completed);
		}
	}
}
