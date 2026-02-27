import type { GoalMetadata, TaskNode } from "../types";

export function generateNoteContent(
	metadata: GoalMetadata,
	phases: TaskNode[],
): string {
	const frontmatter = buildFrontmatter(metadata);
	const body = buildBody(phases);
	return `${frontmatter}\n${body}`;
}

function buildFrontmatter(metadata: GoalMetadata): string {
	const lines = ["---"];
	lines.push(`goal: "${escapeYaml(metadata.goal)}"`);
	if (metadata.budget) lines.push(`budget: "${escapeYaml(metadata.budget)}"`);
	if (metadata.timeline)
		lines.push(`timeline: "${escapeYaml(metadata.timeline)}"`);
	if (metadata.complexity)
		lines.push(`complexity: "${escapeYaml(metadata.complexity)}"`);
	if (metadata.summary)
		lines.push(`summary: "${escapeYaml(metadata.summary)}"`);
	lines.push("---");
	return lines.join("\n");
}

function escapeYaml(s: string): string {
	return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildBody(phases: TaskNode[]): string {
	const lines: string[] = [];
	for (const phase of phases) {
		lines.push(`## ${phase.id}. ${phase.title}`);
		lines.push("");
		for (const sub of phase.children) {
			if (sub.children.length > 0) {
				lines.push(`### ${sub.id} ${sub.title}`);
				lines.push("");
				for (const micro of sub.children) {
					const check = micro.completed ? "x" : " ";
					lines.push(`- [${check}] ${micro.id} ${micro.title}`);
				}
				lines.push("");
			} else {
				const check = sub.completed ? "x" : " ";
				lines.push(`- [${check}] ${sub.id} ${sub.title}`);
			}
		}
	}
	return lines.join("\n");
}

export function buildNotePath(folder: string, goalTitle: string): string {
	const sanitized = goalTitle
		.replace(/[\\/:*?"<>|]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 100);
	return `${folder}/Goal - ${sanitized}.md`;
}
