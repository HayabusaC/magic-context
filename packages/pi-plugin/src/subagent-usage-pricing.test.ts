import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	appendUsagePricingSnapshot,
	consumeUsagePricingSnapshots,
	SUBAGENT_USAGE_SNAPSHOT_ENV,
} from "./subagent-usage-pricing";

test("captures native invocation usage with the actual registry pricing snapshot", () => {
	const dir = mkdtempSync(join(tmpdir(), "magic-context-usage-test-"));
	const path = join(dir, "usage.jsonl");
	const previous = process.env[SUBAGENT_USAGE_SNAPSHOT_ENV];
	process.env[SUBAGENT_USAGE_SNAPSHOT_ENV] = path;
	try {
		appendUsagePricingSnapshot(
			{
				role: "assistant",
				provider: "custom",
				model: "model-a",
				usage: {
					input: 100,
					output: 20,
					cacheRead: 30,
					cacheWrite: 5,
					totalTokens: 155,
					contextTokens: 100_000,
					reasoningTokens: 7,
					cost: { total: 0.00042 },
				},
			},
			{
				getAvailable: () => [
					{
						provider: "custom",
						id: "model-a",
						cost: { input: 2, output: 8, cacheRead: 0.2, cacheWrite: 2.5 },
					},
				],
			},
		);
		const [snapshot] = consumeUsagePricingSnapshots(path);
		expect(snapshot.usage).toEqual({
			input: 100,
			output: 20,
			cacheRead: 30,
			cacheWrite: 5,
			totalTokens: 155,
			reasoningTokens: 7,
		});
		expect(snapshot.pricing?.input).toBe(2);
		expect(snapshot.estimatedCost).toBeCloseTo(0.0003785);
	} finally {
		if (previous === undefined) delete process.env[SUBAGENT_USAGE_SNAPSHOT_ENV];
		else process.env[SUBAGENT_USAGE_SNAPSHOT_ENV] = previous;
		rmSync(dir, { recursive: true, force: true });
	}
});

test("unregistered models keep estimated cost unavailable", () => {
	const dir = mkdtempSync(join(tmpdir(), "magic-context-usage-test-"));
	const path = join(dir, "usage.jsonl");
	const previous = process.env[SUBAGENT_USAGE_SNAPSHOT_ENV];
	process.env[SUBAGENT_USAGE_SNAPSHOT_ENV] = path;
	try {
		appendUsagePricingSnapshot(
			{
				role: "assistant",
				provider: "custom",
				model: "missing",
				usage: {
					input: 1,
					output: 1,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 2,
					cost: { total: 0 },
				},
			},
			{ getAvailable: () => [] },
		);
		expect(consumeUsagePricingSnapshots(path)[0].estimatedCost).toBeNull();
	} finally {
		if (previous === undefined) delete process.env[SUBAGENT_USAGE_SNAPSHOT_ENV];
		else process.env[SUBAGENT_USAGE_SNAPSHOT_ENV] = previous;
		rmSync(dir, { recursive: true, force: true });
	}
});
