import type { GoalNote, GoalMetadata, TaskNode, TaskNote, TaskNoteMetadata, TaskFlag, TaskFlagType, ChatEntry } from "../types";
import { TASK_NOTE_TYPE } from "../constants";

export function parseGoalNote(content: string): GoalNote | null {
	const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!fmMatch) return null;

	const raw = parseRawFrontmatter(fmMatch[1]);
	if (!raw["goal"]) return null;

	const metadata: GoalMetadata = {
		goal: raw["goal"],
		budget: raw["budget"],
		timeline: raw["timeline"],
		complexity: raw["complexity"],
		summary: raw["summary"],
	};

	const body = content.slice(fmMatch[0].length);
	const phases = parseBody(body);
	updateParentCompletion(phases);

	const legacyFlags = raw["flags"] ?? raw["flagged"];
	if (legacyFlags) {
		const flagMap = parseFlags(legacyFlags);
		applyFlags(phases, flagMap);
	}

	return { metadata, phases };
}

export function parseTaskNote(content: string): TaskNote | null {
	const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!fmMatch) return null;

	const raw = parseRawFrontmatter(fmMatch[1]);
	if (raw["type"] !== TASK_NOTE_TYPE) return null;

	const metadata: TaskNoteMetadata = {
		parentGoal: raw["parentGoal"] ?? "",
		goalTitle: raw["goalTitle"] ?? "",
		taskId: raw["taskId"] ?? "",
		taskTitle: raw["taskTitle"] ?? "",
		type: TASK_NOTE_TYPE,
	};

	const rawBody = content.slice(fmMatch[0].length);
	const body = rawBody.replace(/^\n*Parent: \[\[.*?\]\]\n?/, "");

	const chatMarker = "---CHAT---";
	const tasksMarker = "---TASKS---";
	const chatIdx = body.indexOf(chatMarker);
	const tasksIdx = body.indexOf(tasksMarker);

	let phases: TaskNode[] = [];
	let freeContent = "";
	let chatEntries: ChatEntry[] = [];

	if (chatIdx !== -1 && tasksIdx !== -1) {
		freeContent = body.slice(0, chatIdx).trim();
		const chatSection = body.slice(chatIdx + chatMarker.length, tasksIdx).trim();
		chatEntries = parseChatSection(chatSection);
		const tasksBody = body.slice(tasksIdx + tasksMarker.length);
		phases = parseBody(tasksBody);
		updateParentCompletion(phases);
	} else if (chatIdx !== -1) {
		freeContent = body.slice(0, chatIdx).trim();
		const chatSection = body.slice(chatIdx + chatMarker.length).trim();
		chatEntries = parseChatSection(chatSection);
	} else if (tasksIdx !== -1) {
		freeContent = body.slice(0, tasksIdx).trim();
		const tasksBody = body.slice(tasksIdx + tasksMarker.length);
		phases = parseBody(tasksBody);
		updateParentCompletion(phases);
	} else {
		freeContent = body.trim();
	}

	const legacyFlags = raw["flags"];
	if (legacyFlags) {
		const flagMap = parseFlags(legacyFlags);
		applyFlags(phases, flagMap);
	}

	return { metadata, phases, freeContent, chatEntries };
}

export function parseRawFrontmatter(text: string): Record<string, string> {
	const data: Record<string, string> = {};
	for (const line of text.split("\n")) {
		const match = line.match(/^([\w-]+):\s*"?(.*?)"?\s*$/);
		if (match) {
			data[match[1]] = match[2].trim();
		}
	}
	return data;
}

export function parseFlags(raw: string): Map<string, TaskFlag[]> {
	const result = new Map<string, TaskFlag[]>();
	const entries = raw.split(",").map((s) => s.trim()).filter(Boolean);

	for (const entry of entries) {
		if (entry.includes(":")) {
			// New format: "1.1:difficulty=hard" or "1.1:needs-info"
			const colonIdx = entry.indexOf(":");
			const id = entry.slice(0, colonIdx).trim();
			const flagPart = entry.slice(colonIdx + 1).trim();
			const eqIdx = flagPart.indexOf("=");
			let flag: TaskFlag;
			if (eqIdx !== -1) {
				flag = {
					type: flagPart.slice(0, eqIdx) as TaskFlag["type"],
					value: flagPart.slice(eqIdx + 1),
				};
			} else {
				flag = { type: flagPart as TaskFlag["type"] };
			}
			const existing = result.get(id) ?? [];
			existing.push(flag);
			result.set(id, existing);
		} else {
			// Old format: bare ID like "1.1" — convert to priority=medium
			const id = entry.trim();
			const existing = result.get(id) ?? [];
			existing.push({ type: "priority", value: "medium" });
			result.set(id, existing);
		}
	}

	return result;
}

const VALID_FLAG_TYPES = new Set<string>(["difficulty", "priority", "assigned", "needs-info", "blocked"]);

function isValidFlagType(s: string): boolean {
	return VALID_FLAG_TYPES.has(s);
}

export function extractInlineTags(text: string): { cleanTitle: string; flags: TaskFlag[] } {
	const flags: TaskFlag[] = [];
	const cleanTitle = text.replace(/#([\w-]+(?:\/[\w-]+)?)/g, (match, tag: string) => {
		const slashIdx = tag.indexOf("/");
		if (slashIdx !== -1) {
			const type = tag.slice(0, slashIdx);
			const value = tag.slice(slashIdx + 1);
			if (isValidFlagType(type)) {
				flags.push({ type: type as TaskFlagType, value });
				return "";
			}
		} else if (isValidFlagType(tag)) {
			flags.push({ type: tag as TaskFlagType });
			return "";
		}
		return match;
	}).replace(/\s{2,}/g, " ").trim();
	return { cleanTitle, flags };
}

export function parseBody(text: string): TaskNode[] {
	const phases: TaskNode[] = [];
	let currentPhase: TaskNode | null = null;
	let currentSubTask: TaskNode | null = null;

	for (const line of text.split("\n")) {
		const phaseMatch = line.match(/^##\s+(\d+[\d.]*)\.\s+(.+)$/);
		if (phaseMatch) {
			const { cleanTitle: phaseTitle, flags: phaseFlags } = extractInlineTags(phaseMatch[2].trim());
			currentPhase = {
				id: phaseMatch[1],
				title: phaseTitle,
				completed: false,
				flags: phaseFlags,
				children: [],
			};
			phases.push(currentPhase);
			currentSubTask = null;
			continue;
		}

		const subTaskMatch = line.match(/^###\s+(\d+[\d.]*)\s+(.+)$/);
		if (subTaskMatch && currentPhase) {
			const { cleanTitle: subTitle, flags: subFlags } = extractInlineTags(subTaskMatch[2].trim());
			currentSubTask = {
				id: subTaskMatch[1],
				title: subTitle,
				completed: false,
				flags: subFlags,
				children: [],
			};
			currentPhase.children.push(currentSubTask);
			continue;
		}

		const microTaskMatch = line.match(
			/^-\s+\[([ x])\]\s+(\d+[\d.]*)\s+(.+)$/,
		);
		if (microTaskMatch) {
			const { cleanTitle: microTitle, flags: microFlags } = extractInlineTags(microTaskMatch[3].trim());
			const task: TaskNode = {
				id: microTaskMatch[2],
				title: microTitle,
				completed: microTaskMatch[1] === "x",
				flags: microFlags,
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

export function parseChatSection(text: string): ChatEntry[] {
	if (!text.trim()) return [];

	const entries: ChatEntry[] = [];
	// Split on horizontal rules (---) that separate chat entries
	const blocks = text.split(/\n---\n/).map((b) => b.trim()).filter(Boolean);

	for (const block of blocks) {
		const timestampMatch = block.match(/^####\s+(.+)\n/);
		if (!timestampMatch) continue;

		const timestamp = timestampMatch[1].trim();
		const rest = block.slice(timestampMatch[0].length);

		const youMatch = rest.match(/\*\*You:\*\*\s*([\s\S]*?)(?=\n\n\*\*AI:\*\*|$)/);
		const aiMatch = rest.match(/\*\*AI:\*\*\s*([\s\S]*?)$/);

		if (youMatch && aiMatch) {
			entries.push({
				timestamp,
				userMessage: youMatch[1].trim(),
				assistantMessage: aiMatch[1].trim(),
			});
		}
	}

	return entries;
}

function applyFlags(nodes: TaskNode[], flagMap: Map<string, TaskFlag[]>): void {
	for (const node of nodes) {
		const nodeFlags = flagMap.get(node.id);
		if (nodeFlags) {
			node.flags = nodeFlags;
		}
		if (node.children.length > 0) {
			applyFlags(node.children, flagMap);
		}
	}
}

function updateParentCompletion(nodes: TaskNode[]): void {
	for (const node of nodes) {
		if (node.children.length > 0) {
			updateParentCompletion(node.children);
			node.completed = node.children.every((c) => c.completed);
		}
	}
}
