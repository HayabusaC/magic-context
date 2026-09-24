import { expect, test } from "bun:test";
import { Database } from "../../shared/sqlite";
import { closeQuietly } from "../../shared/sqlite-helpers";
import { runMigrations } from "./migrations";

test("v91 extends existing invocation rows without inventing historical prices", () => {
    const db = new Database(":memory:");
    try {
        db.exec(`CREATE TABLE schema_migrations
            (version INTEGER PRIMARY KEY, description TEXT NOT NULL, applied_at INTEGER NOT NULL);
            INSERT INTO schema_migrations VALUES (90, 'previous schema', 1);
            CREATE TABLE subagent_invocations (id INTEGER PRIMARY KEY, input_tokens INTEGER);
            INSERT INTO subagent_invocations VALUES (1, 42);`);
        runMigrations(db);
        runMigrations(db);
        const row = db
            .prepare(`SELECT input_tokens, component, reasoning_tokens, total_tokens,
            pricing_snapshot, estimated_cost FROM subagent_invocations WHERE id=1`)
            .get() as Record<string, unknown>;
        expect(row).toEqual({
            input_tokens: 42,
            component: null,
            reasoning_tokens: null,
            total_tokens: null,
            pricing_snapshot: null,
            estimated_cost: null,
        });
        expect(
            db.prepare("SELECT name FROM sqlite_master WHERE name='embedding_usage'").get(),
        ).toBeTruthy();
    } finally {
        closeQuietly(db);
    }
});
