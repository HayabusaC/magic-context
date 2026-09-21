/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import { isCompactionEnabled, isHistorianRunnable } from "../../config/agent-disable";
import type { RawMessage } from "../../hooks/magic-context/read-session-raw";
import { rawMessages } from "../hooks/store";
import type { StoreRow } from "../store-reader";
import { v2HostCompactionBoundary } from "./boundary";

/** u1 a1 u2 a2 — then a completed compaction row, then u3 a3. */
const history: StoreRow[] = [
    { id: "u1", session_id: "ses", seq: 0, type: "user", data: { text: "u1" } },
    { id: "a1", session_id: "ses", seq: 1, type: "assistant", data: { content: [] } },
    { id: "u2", session_id: "ses", seq: 2, type: "user", data: { text: "u2" } },
    { id: "a2", session_id: "ses", seq: 3, type: "assistant", data: { content: [] } },
    {
        id: "cut",
        session_id: "ses",
        seq: 4,
        type: "compaction",
        data: { status: "completed", summary: "folded" },
    },
    { id: "u3", session_id: "ses", seq: 5, type: "user", data: { text: "u3" } },
    { id: "a3", session_id: "ses", seq: 6, type: "assistant", data: { content: [] } },
];

const projection: RawMessage[] = rawMessages(history);
const cut = history.find((row) => row.type === "compaction");

describe("v2HostCompactionBoundary", () => {
    it("reports the newest conversational message the host's cut covers", () => {
        // The compaction row sits after a2, so a2 is the newest message inside the
        // fold. The compaction row itself carries no raw ordinal.
        expect(v2HostCompactionBoundary(history, projection, cut)).toEqual({
            endMessageId: "a2",
            ordinal: 4,
        });
    });

    it("reports no boundary for a session that has never folded", () => {
        expect(v2HostCompactionBoundary(history, projection, undefined)).toEqual({
            endMessageId: null,
            ordinal: null,
        });
    });

    it("distinguishes 'never folded' from a boundary at ordinal zero", () => {
        // A null ordinal must not be read as 0 by a caller comparing coverage.
        const none = v2HostCompactionBoundary(history, projection, undefined);
        expect(none.ordinal).toBeNull();
        expect(none.ordinal).not.toBe(0);
    });

    it("moves with the cut rather than pinning the first fold", () => {
        const later: StoreRow = {
            id: "cut2",
            session_id: "ses",
            seq: 7,
            type: "compaction",
            data: { status: "completed", summary: "folded again" },
        };
        const extended = [...history, later];
        expect(v2HostCompactionBoundary(extended, rawMessages(extended), later)).toEqual({
            endMessageId: "a3",
            ordinal: 6,
        });
    });

    it("reports no boundary when the cut precedes every conversational row", () => {
        const early: StoreRow[] = [
            {
                id: "cut0",
                session_id: "ses",
                seq: 0,
                type: "compaction",
                data: { status: "completed" },
            },
            { id: "u1", session_id: "ses", seq: 1, type: "user", data: { text: "u1" } },
        ];
        expect(v2HostCompactionBoundary(early, rawMessages(early), early[0])).toEqual({
            endMessageId: null,
            ordinal: null,
        });
    });
});

/**
 * There is no second boundary carrier on this host, and no fallback that would
 * need one. The only way a module boundary is published is a historian
 * publication, and the v2 lane gates the historian on compaction being enabled —
 * the same expression `registerContext` builds `historianRunnable` from. With
 * compaction off there is no historian, so no publication, so no boundary to
 * carry anywhere.
 */
describe("compaction-off needs no boundary fallback", () => {
    /**
     * The two config-derived conjuncts of the `historianRunnable` expression
     * `registerContext` builds. The third is that a hidden-completion executor
     * exists, which is a storage fact rather than a config one. Both helpers are
     * the shared readers, imported rather than re-derived.
     */
    const runnable = (config: {
        historian?: { disable?: boolean } | null;
        compaction?: { enabled?: boolean } | null;
    }) => isCompactionEnabled(config) && isHistorianRunnable(config);

    it("does not run the historian when compaction is off", () => {
        expect(runnable({ compaction: { enabled: false } })).toBe(false);
        expect(runnable({ compaction: { enabled: false }, historian: { disable: false } })).toBe(
            false,
        );
    });

    it("runs it when compaction is on and the historian is not disabled", () => {
        expect(runnable({})).toBe(true);
        expect(runnable({ compaction: { enabled: true } })).toBe(true);
        expect(runnable({ historian: { disable: true } })).toBe(false);
    });
});
