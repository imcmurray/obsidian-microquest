import type { GoalMetadata, TaskNode, TaskNoteMetadata, ChatEntry, TaskFlag } from "../types";

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
	lines.push("tags:");
	lines.push("  - microquest");
	lines.push("---");
	return lines.join("\n");
}

function escapeYaml(s: string): string {
	return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatInlineTags(flags: TaskFlag[]): string {
	if (flags.length === 0) return "";
	const tags = flags.map((flag) => {
		if (flag.value) {
			const sanitized = flag.value.toLowerCase().replace(/\s+/g, "-");
			return `#${flag.type}/${sanitized}`;
		}
		return `#${flag.type}`;
	});
	return " " + tags.join(" ");
}

export function buildBody(phases: TaskNode[]): string {
	const lines: string[] = [];
	for (const phase of phases) {
		lines.push(`## ${phase.id}. ${phase.title}${formatInlineTags(phase.flags)}`);
		lines.push("");
		for (const sub of phase.children) {
			if (sub.children.length > 0) {
				lines.push(`### ${sub.id} ${sub.title}${formatInlineTags(sub.flags)}`);
				lines.push("");
				for (const micro of sub.children) {
					const check = micro.completed ? "x" : " ";
					lines.push(`- [${check}] ${micro.id} ${micro.title}${formatInlineTags(micro.flags)}`);
				}
				lines.push("");
			} else {
				const check = sub.completed ? "x" : " ";
				lines.push(`- [${check}] ${sub.id} ${sub.title}${formatInlineTags(sub.flags)}`);
			}
		}
	}
	return lines.join("\n");
}

function sanitizePathSegment(s: string, maxLen: number): string {
	return s
		.replace(/[\\/:*?"<>|]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, maxLen);
}

export function buildGoalFolderPath(folder: string, goalTitle: string): string {
	const sanitized = sanitizePathSegment(goalTitle, 100);
	return `${folder}/${sanitized}`;
}

export function buildNotePath(folder: string, goalTitle: string): string {
	const sanitized = sanitizePathSegment(goalTitle, 100);
	return `${folder}/${sanitized}/Goal - ${sanitized}.md`;
}

export function generateTaskNoteContent(
	metadata: TaskNoteMetadata,
	phases: TaskNode[],
	freeContent?: string,
	chatEntries?: ChatEntry[],
	parentFileName?: string,
): string {
	const lines = [
		"---",
		`type: "${metadata.type}"`,
		`parentGoal: "${escapeYaml(metadata.parentGoal)}"`,
		`goalTitle: "${escapeYaml(metadata.goalTitle)}"`,
		`taskId: "${escapeYaml(metadata.taskId)}"`,
		`taskTitle: "${escapeYaml(metadata.taskTitle)}"`,
	];
	lines.push("tags:");
	lines.push("  - microquest");
	lines.push("---");

	const linkTarget = parentFileName
		?? `Goal - ${sanitizePathSegment(metadata.goalTitle, 100)}`;
	lines.push("");
	lines.push(`Parent: [[${linkTarget}]]`);

	if (freeContent) {
		lines.push("");
		lines.push(freeContent);
	}

	if (chatEntries && chatEntries.length > 0) {
		lines.push("");
		lines.push("---CHAT---");
		lines.push("");
		lines.push(buildChatSection(chatEntries));
	}

	if (phases.length > 0) {
		lines.push("");
		lines.push("---TASKS---");
		lines.push("");
		lines.push(buildBody(phases));
	}

	return lines.join("\n");
}

export function buildChatSection(entries: ChatEntry[]): string {
	const blocks: string[] = [];
	for (const entry of entries) {
		const block = [
			`#### ${entry.timestamp}`,
			`**You:** ${entry.userMessage}`,
			"",
			`**AI:** ${entry.assistantMessage}`,
		];
		blocks.push(block.join("\n"));
	}
	return blocks.join("\n\n---\n\n");
}

export function buildTaskNotePath(
	folder: string,
	goalTitle: string,
	taskId: string,
	taskTitle: string,
): string {
	const goalFolder = buildGoalFolderPath(folder, goalTitle);
	const sanitizedTask = sanitizePathSegment(taskTitle, 60);
	return `${goalFolder}/Task - ${taskId} ${sanitizedTask}.md`;
}

function findNodeById(nodes: TaskNode[], id: string): TaskNode | undefined {
	for (const node of nodes) {
		if (node.id === id) return node;
		const found = findNodeById(node.children, id);
		if (found) return found;
	}
	return undefined;
}

export function buildIdTaskNotePath(
	folder: string,
	goalTitle: string,
	taskId: string,
	taskTitle: string,
	phases: TaskNode[],
): string {
	const goalFolder = buildGoalFolderPath(folder, goalTitle);
	const parts = taskId.split(".");
	let path = goalFolder;

	for (let i = 1; i < parts.length; i++) {
		const ancestorId = parts.slice(0, i).join(".");
		const ancestorNode = findNodeById(phases, ancestorId);
		const ancestorTitle = ancestorNode ? ancestorNode.title : "";
		const folderName = sanitizePathSegment(`${ancestorId} ${ancestorTitle}`, 60);
		path += `/${folderName}`;
	}

	const sanitizedTask = sanitizePathSegment(taskTitle, 60);
	return `${path}/Task - ${taskId} ${sanitizedTask}.md`;
}

export function buildNestedTaskNotePath(
	parentNotePath: string,
	parentTaskId: string,
	parentTaskTitle: string,
	taskId: string,
	taskTitle: string,
): string {
	const parentDir = parentNotePath.replace(/\/[^/]+\.md$/, "");
	const folderName = sanitizePathSegment(`${parentTaskId} ${parentTaskTitle}`, 60);
	const sanitizedTask = sanitizePathSegment(taskTitle, 60);
	return `${parentDir}/${folderName}/Task - ${taskId} ${sanitizedTask}.md`;
}

export async function ensureParentFolders(
	vault: { getAbstractFileByPath(path: string): unknown; createFolder(path: string): Promise<unknown> },
	filePath: string,
): Promise<void> {
	const dir = filePath.replace(/\/[^/]+$/, "");
	const segments = dir.split("/");
	let current = "";
	for (const segment of segments) {
		current = current ? `${current}/${segment}` : segment;
		if (!vault.getAbstractFileByPath(current)) {
			await vault.createFolder(current);
		}
	}
}

