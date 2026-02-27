import { requestUrl } from "obsidian";
import type { ConversationMessage } from "../types";

const API_URL = "https://api.anthropic.com/v1/messages";

interface ContentBlock {
	type: string;
	text?: string;
}

interface ApiResponse {
	content?: ContentBlock[];
	error?: { message: string };
}

export async function sendMessage(
	apiKey: string,
	model: string,
	systemPrompt: string,
	messages: ConversationMessage[],
): Promise<string> {
	const response = await requestUrl({
		url: API_URL,
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
		},
		body: JSON.stringify({
			model,
			max_tokens: 4096,
			system: systemPrompt,
			messages: messages.map((m) => ({
				role: m.role,
				content: m.content,
			})),
		}),
	});

	if (response.status !== 200) {
		const error = response.json as ApiResponse;
		throw new Error(
			`API error (${response.status}): ${error?.error?.message ?? "Unknown error"}`,
		);
	}

	const data = response.json as ApiResponse;
	const textBlock = data.content?.find((b) => b.type === "text");
	if (!textBlock?.text) {
		throw new Error("No text content in API response");
	}
	return textBlock.text;
}
