import { expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import subagentUsageExtension from "./subagent-usage-entry";
import { SUBAGENT_USAGE_SNAPSHOT_ENV } from "./subagent-usage-pricing";

it("writes an OMP message_end usage snapshot without registering tools", () => {
	const directory = mkdtempSync(join(tmpdir(), "mc-usage-entry-"));
	const path = join(directory, "usage.jsonl");
	const previous = process.env[SUBAGENT_USAGE_SNAPSHOT_ENV];
	process.env[SUBAGENT_USAGE_SNAPSHOT_ENV] = path;
	try {
		const listeners = new Map<string, (event: unknown, ctx: unknown) => void>();
		const api = {
			on: (name: string, listener: (event: unknown, ctx: unknown) => void) =>
				listeners.set(name, listener),
			registerTool: () => {
				throw new Error("usage entry must not register tools");
			},
		} as unknown as ExtensionAPI;
		subagentUsageExtension(api);
		expect([...listeners.keys()]).toEqual(["message_end"]);
		listeners.get("message_end")?.(
			{
				message: {
					role: "assistant",
					provider: "example",
					model: "model",
					usage: {
						input: 10,
						output: 2,
						cacheRead: 0,
						cacheWrite: 0,
						totalTokens: 12,
					},
				},
			},
			{
				modelRegistry: {
					getAvailable: () => [
						{
							provider: "example",
							id: "model",
							cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
						},
					],
				},
			},
		);
		expect(existsSync(path)).toBe(true);
		const snapshot = JSON.parse(readFileSync(path, "utf8").trim()) as {
			estimatedCost: number;
			usage: { input: number };
		};
		expect(snapshot.usage.input).toBe(10);
		expect(snapshot.estimatedCost).toBeGreaterThan(0);
	} finally {
		if (previous === undefined) delete process.env[SUBAGENT_USAGE_SNAPSHOT_ENV];
		else process.env[SUBAGENT_USAGE_SNAPSHOT_ENV] = previous;
		rmSync(directory, { recursive: true, force: true });
	}
});
