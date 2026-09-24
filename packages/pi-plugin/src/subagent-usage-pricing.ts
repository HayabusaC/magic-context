import { appendFileSync, readFileSync, unlinkSync } from "node:fs";
import { calculateUsageCost } from "@oh-my-pi/pi-catalog/models";

export const SUBAGENT_USAGE_SNAPSHOT_ENV =
	"MAGIC_CONTEXT_SUBAGENT_USAGE_SNAPSHOT";

export interface UsagePricingSnapshot {
	provider: string;
	model: string;
	usage: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		totalTokens: number;
		reasoningTokens?: number;
	};
	pricing: Record<string, unknown> | null;
	estimatedCost: number | null;
}

/** The child extension sees the actual model registry and native Usage. */
export function appendUsagePricingSnapshot(
	message: unknown,
	registry: unknown,
): void {
	const path = process.env[SUBAGENT_USAGE_SNAPSHOT_ENV];
	if (!path || !message || typeof message !== "object") return;
	const assistant = message as Record<string, unknown>;
	if (
		assistant.role !== "assistant" ||
		!assistant.usage ||
		typeof assistant.usage !== "object"
	)
		return;
	const usage = assistant.usage as Record<string, unknown>;
	const provider =
		typeof assistant.provider === "string" ? assistant.provider : "";
	const model = typeof assistant.model === "string" ? assistant.model : "";
	const available =
		(
			registry as { getAvailable?: (kind?: string) => unknown[] } | null
		)?.getAvailable?.("all") ?? [];
	const registered = available.find((item) => {
		const candidate = item as { provider?: unknown; id?: unknown };
		return candidate.provider === provider && candidate.id === model;
	}) as { cost?: Record<string, unknown> } | undefined;
	const number = (value: unknown): number =>
		typeof value === "number" && Number.isFinite(value) ? value : 0;
	const pricing = registered?.cost
		? (JSON.parse(JSON.stringify(registered.cost)) as Record<string, unknown>)
		: null;
	let estimatedCost: number | null = null;
	if (pricing) {
		const calculationUsage = {
			...usage,
			input: number(usage.input),
			output: number(usage.output),
			cacheRead: number(usage.cacheRead),
			cacheWrite: number(usage.cacheWrite),
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		} as Parameters<typeof calculateUsageCost>[1];
		const result = calculateUsageCost(
			pricing as unknown as Parameters<typeof calculateUsageCost>[0],
			calculationUsage,
			typeof assistant.timestamp === "number" ? assistant.timestamp : undefined,
		);
		if (Number.isFinite(result.total)) estimatedCost = result.total;
	}
	const entry: UsagePricingSnapshot = {
		provider,
		model,
		usage: {
			input: number(usage.input),
			output: number(usage.output),
			cacheRead: number(usage.cacheRead),
			cacheWrite: number(usage.cacheWrite),
			totalTokens: number(usage.totalTokens),
			...(typeof usage.reasoningTokens === "number"
				? { reasoningTokens: usage.reasoningTokens }
				: {}),
		},
		pricing,
		estimatedCost,
	};
	appendFileSync(path, `${JSON.stringify(entry)}\n`, {
		encoding: "utf8",
		mode: 0o600,
	});
}

export function consumeUsagePricingSnapshots(
	path: string,
): UsagePricingSnapshot[] {
	try {
		return readFileSync(path, "utf8")
			.split(/\r?\n/)
			.filter(Boolean)
			.map((line) => JSON.parse(line) as UsagePricingSnapshot);
	} catch {
		return [];
	} finally {
		try {
			unlinkSync(path);
		} catch {
			/* no snapshot was written */
		}
	}
}
