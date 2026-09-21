/// <reference types="bun-types" />

/**
 * Adversarial tests for the single-store embedding watermark.
 *
 * The watermark exists because a memory the Rust module writes straight into
 * `context.db` arrives with no vector and nothing asks for one. The drain is what asks.
 * The question this file answers is what the drain does when the asking fails — a
 * provider outage, the most ordinary failure an embedding call has.
 *
 * The answer, recorded below, is that the drain treats "embedded nothing" as "nothing
 * left to embed" and advances the mark past rows that are still unembedded. These tests
 * record a defect rather than a guarantee: when the drain learns to tell an outage from a
 * finished range, these expectations have to be inverted.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { EmbeddingConfig } from "../../../config/schema/magic-context";
import {
    _resetProjectEmbeddingRegistryForTests,
    _setTestProviderFactoryForProject,
    embedUnembeddedMemoriesForProject,
    registerProjectEmbedding,
} from "../project-embedding-registry";
import { closeDatabase, openDatabase } from "../storage";
import type { EmbeddingProvider, EmbeddingPurpose } from "./embedding-provider";
import {
    drainSingleStoreEmbeddingWatermarks,
    getPendingEmbeddingWatermarks,
} from "./single-store-embedding-drain";
import { insertMemory } from "./storage-memory";

const PROJECT = "git:single-store-outage";

/** A provider that is configured, loaded, and failing — an outage, not a misconfiguration. */
class OutageProvider implements EmbeddingProvider {
    readonly modelId = "gate-model";
    static failing = true;

    async initialize(): Promise<boolean> {
        return true;
    }

    async embed(text: string, _signal?: AbortSignal, _purpose?: EmbeddingPurpose) {
        if (OutageProvider.failing) throw new Error("embedding provider is down");
        return new Float32Array([text.length, 1]);
    }

    async embedBatch(texts: string[], _signal?: AbortSignal, _purpose?: EmbeddingPurpose) {
        if (OutageProvider.failing) throw new Error("embedding provider is down");
        return texts.map((text) => new Float32Array([text.length, 1]));
    }

    async dispose(): Promise<void> {}

    isLoaded(): boolean {
        return true;
    }
}

function localConfig(model: string): EmbeddingConfig {
    return { provider: "local", model };
}

describe("single-store embedding watermark under a provider outage", () => {
    const tempDirs: string[] = [];
    const originalXdgDataHome = process.env.XDG_DATA_HOME;

    afterEach(() => {
        OutageProvider.failing = true;
        _resetProjectEmbeddingRegistryForTests();
        closeDatabase();
        if (originalXdgDataHome === undefined) delete process.env.XDG_DATA_HOME;
        else process.env.XDG_DATA_HOME = originalXdgDataHome;
        for (const dir of tempDirs) {
            try {
                rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
            } catch {
                /* Ignore EBUSY on Windows */
            }
        }
        tempDirs.length = 0;
    });

    test("an outage retires the watermark and leaves the rows for the ordinary sweep", async () => {
        OutageProvider.failing = true;
        _setTestProviderFactoryForProject(() => new OutageProvider());
        const dir = mkdtempSync(join(tmpdir(), "single-store-drain-gate-"));
        tempDirs.push(dir);
        process.env.XDG_DATA_HOME = dir;
        const db = openDatabase();

        const ids = ["first", "second", "third"].map(
            (label) =>
                insertMemory(db, {
                    projectPath: PROJECT,
                    category: "ARCHITECTURE",
                    content: `a module-written memory: ${label}`,
                }).id,
        );
        registerProjectEmbedding(
            db,
            PROJECT,
            localConfig("gate-model"),
            { memoryEnabled: true, gitCommitEnabled: false },
            "/tmp/single-store-drain-gate",
        );
        db.prepare(
            `INSERT INTO memory_embedding_watermarks
                (project_path, written_memory_id, embedded_memory_id, updated_at)
             VALUES (?, ?, 0, 0)`,
        ).run(PROJECT, Math.max(...ids));

        // One drain during the outage.
        expect(await drainSingleStoreEmbeddingWatermarks(db)).toBe(0);

        const unembedded = () =>
            (
                db
                    .prepare(
                        `SELECT COUNT(*) AS count FROM memories
                          WHERE project_path = ?
                            AND NOT EXISTS (SELECT 1 FROM memory_embeddings WHERE memory_id = memories.id)`,
                    )
                    .get(PROJECT) as { count: number }
            ).count;

        // Every row is still unembedded...
        expect(unembedded()).toBe(3);
        // ...and the watermark has moved past all of them anyway.
        expect(
            db
                .prepare(
                    "SELECT embedded_memory_id FROM memory_embedding_watermarks WHERE project_path = ?",
                )
                .get(PROJECT),
        ).toEqual({ embedded_memory_id: Math.max(...ids) });
        expect(getPendingEmbeddingWatermarks(db)).toEqual([]);

        // The provider comes back. The watermark no longer knows about these rows, so
        // every further drain is a no-op: the mark cannot recover what it skipped.
        OutageProvider.failing = false;
        expect(await drainSingleStoreEmbeddingWatermarks(db)).toBe(0);
        expect(unembedded()).toBe(3);

        // Only the ordinary project sweep — the dream timer's maintenance pass, or the
        // next ctx_memory write on this project — still finds them. That is the real
        // recovery path, and it is not the one the embedding watermark provides.
        expect(await embedUnembeddedMemoriesForProject(db, PROJECT, 10)).toBe(3);
        expect(unembedded()).toBe(0);
    });

    test("a partially drained range keeps its watermark, so a short batch resumes", async () => {
        OutageProvider.failing = false;
        _setTestProviderFactoryForProject(() => new OutageProvider());
        const dir = mkdtempSync(join(tmpdir(), "single-store-drain-gate-batch-"));
        tempDirs.push(dir);
        process.env.XDG_DATA_HOME = dir;
        const db = openDatabase();

        // The drain calls the embedder with its default batch size of ten, so a project
        // with more module-written memories than that cannot finish in one pass.
        const ids = Array.from(
            { length: 14 },
            (_, index) =>
                insertMemory(db, {
                    projectPath: PROJECT,
                    category: "ARCHITECTURE",
                    content: `a module-written memory number ${index}`,
                }).id,
        );
        registerProjectEmbedding(
            db,
            PROJECT,
            localConfig("gate-model"),
            { memoryEnabled: true, gitCommitEnabled: false },
            "/tmp/single-store-drain-gate-batch",
        );
        db.prepare(
            `INSERT INTO memory_embedding_watermarks
                (project_path, written_memory_id, embedded_memory_id, updated_at)
             VALUES (?, ?, 0, 0)`,
        ).run(PROJECT, Math.max(...ids));

        expect(await drainSingleStoreEmbeddingWatermarks(db)).toBe(10);
        // Four rows are still below the written mark, so the mark stays where it was and
        // the next pass picks them up.
        expect(getPendingEmbeddingWatermarks(db).map((row) => row.project_path)).toEqual([PROJECT]);

        expect(await drainSingleStoreEmbeddingWatermarks(db)).toBe(4);
        expect(getPendingEmbeddingWatermarks(db)).toEqual([]);
    });
});
