import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OpenAICompatibleEmbeddingProvider } from "./memory/embedding-openai";
import { closeDatabase, openDatabase } from "./storage-db";
import { estimatedEmbeddingCost } from "./storage-embedding-usage";

test("remote embedding uses its saved price and provider input tokens", () => {
    expect(
        estimatedEmbeddingCost({
            inputTokens: 2_500,
            pricePerMillionInputTokens: 0.4,
            local: false,
        }),
    ).toBe(0.001);
    expect(
        estimatedEmbeddingCost({
            inputTokens: null,
            pricePerMillionInputTokens: 0.4,
            local: false,
        }),
    ).toBeNull();
    expect(
        estimatedEmbeddingCost({
            inputTokens: 2_500,
            pricePerMillionInputTokens: null,
            local: false,
        }),
    ).toBeNull();
});

test("local embedding has zero API cost even without token accounting", () => {
    expect(
        estimatedEmbeddingCost({
            inputTokens: null,
            pricePerMillionInputTokens: null,
            local: true,
        }),
    ).toBe(0);
});

test("remote embedding records response input tokens, dimensions and a frozen price", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mc-embedding-usage-"));
    const previousDir = process.env.MAGIC_CONTEXT_TEST_DATA_DIR;
    const previousFetch = globalThis.fetch;
    process.env.MAGIC_CONTEXT_TEST_DATA_DIR = dir;
    globalThis.fetch = (async () =>
        new Response(
            JSON.stringify({
                model: "embed-a",
                usage: { prompt_tokens: 2_000 },
                data: [{ embedding: [0.1, 0.2, 0.3] }],
            }),
            { status: 200 },
        )) as typeof fetch;
    try {
        const db = openDatabase();
        if (!db) throw new Error("test database unavailable");
        const client = new OpenAICompatibleEmbeddingProvider({
            endpoint: "https://example.com/v1",
            model: "embed-a",
            pricePerMillionInputTokens: 0.5,
        });
        const [vector] = await client.embedBatch(["hello"]);
        expect(vector?.length).toBe(3);
        const row = db.prepare("SELECT * FROM embedding_usage").get() as Record<string, unknown>;
        expect(row.requests).toBe(1);
        expect(row.provider_id).toBe("openai-compatible:example.com");
        expect(row.input_tokens).toBe(2_000);
        expect(row.dimensions).toBe(3);
        expect(row.price_per_million_input_tokens).toBe(0.5);
        expect(row.estimated_cost).toBe(0.001);
    } finally {
        globalThis.fetch = previousFetch;
        closeDatabase();
        if (previousDir === undefined) delete process.env.MAGIC_CONTEXT_TEST_DATA_DIR;
        else process.env.MAGIC_CONTEXT_TEST_DATA_DIR = previousDir;
        try {
            rmSync(dir, { recursive: true, force: true });
        } catch {
            /* Windows SQLite handle */
        }
    }
});
