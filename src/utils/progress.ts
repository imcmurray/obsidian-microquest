import type { TaskNode } from "../types";

export interface ProgressInfo {
	total: number;
	completed: number;
	percentage: number;
}

export function calculateProgress(phases: TaskNode[]): ProgressInfo {
	let total = 0;
	let completed = 0;

	function countLeaves(nodes: TaskNode[]): void {
		for (const node of nodes) {
			if (node.children.length === 0) {
				total++;
				if (node.completed) completed++;
			} else {
				countLeaves(node.children);
			}
		}
	}

	countLeaves(phases);
	const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
	return { total, completed, percentage };
}
