import { getOpenDatabase } from "./storage-db";

export interface EmbeddingUsageInput {
    timestamp?: number;
    providerId: string;
    modelId: string;
    requests?: number;
    inputTokens: number | null;
    dimensions: number | null;
    pricePerMillionInputTokens: number | null;
    local: boolean;
}

export function estimatedEmbeddingCost(
    input: Pick<EmbeddingUsageInput, "inputTokens" | "pricePerMillionInputTokens" | "local">,
): number | null {
    if (input.local) return 0;
    if (input.inputTokens === null || input.pricePerMillionInputTokens === null) return null;
    return (input.inputTokens * input.pricePerMillionInputTokens) / 1_000_000;
}

/** One record per actual embedding client call. Missing token usage remains NULL. */
export function recordEmbeddingUsage(input: EmbeddingUsageInput): void {
    try {
        const db = getOpenDatabase();
        if (!db) return;
        const tokens = input.inputTokens;
        const price = input.local ? 0 : input.pricePerMillionInputTokens;
        const cost = estimatedEmbeddingCost(input);
        db.prepare(`INSERT INTO embedding_usage
            (timestamp, provider_id, model_id, requests, input_tokens, dimensions,
             price_per_million_input_tokens, estimated_cost)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
            input.timestamp ?? Date.now(),
            input.providerId,
            input.modelId,
            input.requests ?? 1,
            tokens,
            input.dimensions,
            price,
            cost,
        );
    } catch {
        // Telemetry must never interrupt embedding.
    }
}
