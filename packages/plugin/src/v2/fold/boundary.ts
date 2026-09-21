import type { RawMessage } from "../../hooks/magic-context/read-session-raw";
import type { StoreRow } from "../store-reader";

/**
 * The boundary Magic Context has already folded this session at, on OpenCode 2.
 *
 * There is exactly one of these and the host owns it. When Magic Context answers
 * the `compaction` hook the host records a real compaction row and serves the
 * conversation from it, so that row is both the checkpoint `FoldOwner` binds to
 * and the cut that decides what reaches the module. A second, separately
 * persisted record would be a copy of it that can disagree with it.
 *
 * The row itself carries no raw ordinal — the raw projection skips compaction
 * rows — so the boundary is reported as the last conversational message at or
 * before the cut, which is the newest message the fold covers.
 *
 * Returns nulls when the session has never folded, which every caller reads as
 * "no boundary yet" rather than as ordinal zero.
 */
export function v2HostCompactionBoundary(
    history: readonly StoreRow[],
    rawProjection: readonly RawMessage[],
    cut: StoreRow | undefined,
): { endMessageId: string | null; ordinal: number | null } {
    if (!cut) return { endMessageId: null, ordinal: null };
    const covered = new Set(history.filter((row) => row.seq < cut.seq).map((row) => row.id));
    for (let index = rawProjection.length - 1; index >= 0; index -= 1) {
        const message = rawProjection[index];
        if (message && covered.has(message.id)) {
            return { endMessageId: message.id, ordinal: message.ordinal };
        }
    }
    return { endMessageId: null, ordinal: null };
}
