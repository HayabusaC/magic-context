# Executing adversarial gate — Rust standalone B1 (`gate/rust-b1`, `84d899be`)

Verdict: **SHIP-WITH-PINS**

Gate branch: `gate/rust-b1-gate` (this branch, `alfonso/task/bg_a0e8c3971a258c80-…`)
Under test: `84d899be` "single-store B1 — the module writes context.db's domain tables…"
Slice report: `.cortexkit/alfonso/reviews/rust-standalone-b1.md`
Design of record: `.cortexkit/alfonso/plans/rust-mode-standalone.md` §3, §6B (B1–B8), §7B, §8

No product code was changed by this gate. Everything below was executed on this branch;
each finding names the file and line, and each pinned defect has a committed test that goes
red when the defect is fixed (they are written as defect pins and say so in their doc
comments).

Tests added by this gate (committed, green):

- `crates/mc-module/tests/single_store_gate.rs` — 12 tests + 2 instruments
- `packages/plugin/src/features/magic-context/memory/single-store-embedding-drain-gate.test.ts` — 2 tests

---

## Why SHIP-WITH-PINS and not BLOCK

Everything this slice ships is inert. `single_store` defaults `off`
(`crates/mc-module/src/config.rs:166`), `on` is refused by name
(`crates/mc-module/src/host_store.rs:1846-1851`), and the only two production paths that
can open `context.db` are both behind a mode check that `off` fails
(`host_store.rs:1963-1977` and `host_store.rs:2010-2012`). I could not make `off` touch the
file (F1.1 below).

Every defect I found is a defect in what happens when `on` is turned on. None of them is
reachable in this release. But four of them are load-bearing for B2, and two of them
(F4.1, F7.1) contradict properties the slice report states as held rather than as pending,
so they are pins on the merge rather than notes for later.

The one thing that is not inert is the pair of migrations: TS `v89` and mc-store `59`. They
move the `context.db` fence today for a table nothing reads until B2 (F8.2).

---

## What was executed

| Gate | Command | Result |
| --- | --- | --- |
| Rust build | `cargo build --locked -p mc-module --tests` | pass |
| Rust tests | `cargo test --locked -p mc-module -p mc-store --no-fail-fast` | 1239 + 159 + all integration targets pass; **one pre-existing red**: `cold_flip_adversarial::subagent_flip_records_action_and_stable_tagged_replay` (declared in the brief) |
| Gate tests | `cargo test --locked -p mc-module --test single_store_gate` | 12 pass, 2 ignored (instruments) |
| Clippy | `cargo clippy --locked --all-targets -- -D warnings` | pass |
| Format | `cargo fmt --check` | clean |
| Golden | `bun scripts/single-store-golden.ts` | "every compared column matches", exit 0 |
| Plugin types | `bun run --cwd packages/plugin typecheck` | pass |
| Plugin lint | `bun run --cwd packages/plugin lint` | pass |
| Plugin suite | `bun run --cwd packages/plugin test` | 5153 pass / 0 fail (5151 + this gate's 2) |
| Chunk instrument | `cargo test -p mc-module --lib host_store::tests::measure -- --ignored --nocapture` | reproduced, see §7 |
| Seeded instrument | `cargo test -p mc-module --test single_store_gate -- --ignored --nocapture` | see §7 |
| Hermetic e2e (per-file) | `MC_E2E_MODE=rust bun test tests/rust-memory-update-reembed.test.ts` | 1 pass / 0 fail (199 s) |
| Hermetic e2e (per-file) | `MC_E2E_MODE=rust bun test tests/rust-steady-state-byte-identity.test.ts` | see §1 |
| Hermetic e2e (group) | `scripts/run-rust-hermetic-e2e.sh` | still refuses: manifest validator reports 10 unlisted `tests/opencode2/*` — pre-existing, and already repaired on `gate/f1-rebase` (F1.1) |

---

## 1. Off is off

**Executed.** `single_store_gate.rs::off_mode_leaves_every_byte_of_context_db_alone` builds
a `context.db` under a temp `XDG`/`MAGIC_CONTEXT_TEST_DATA_DIR`, takes it out of WAL so the
main file is the whole database, SHA-256s it, then drives both production entry points —
`host_store::status_value()` and `host_store::verify_publish_in_shadow()` — with the mode
at its default. The hash is unchanged and no `-wal`/`-shm` sidecar appears. A sidecar is
the sharper half of that assertion: `HostStore::open` issues
`PRAGMA journal_mode = WAL` (`host_store.rs:687-691`), so merely opening the file would
leave a trace even if nothing were written.

**Static confirmation.** Every non-test `HostStore::open` in the crate is at
`host_store.rs:1973` (`status_value`, inside the `Shadow | On` arm) and `host_store.rs:2021`
(`verify_publish_in_shadow`, after `if mode() != Shadow { return None }`). The third,
`host_store.rs:1781`, opens the `VACUUM INTO` scratch copy and is reachable only from
`shadow_publish`. There is no fourth.

**Wire bytes.** The commit changes no golden vector and no transform source: the diff
against its base touches `config.rs`, `historian.rs`, `host_store.rs` (new), `lib.rs`,
`mc-store/src/lib.rs`, and TypeScript. Every golden family passes unchanged —
`caveman::differential_golden_matches_typescript_oracle`, `d5_output_identity_vectors`
(19), `d5_coverage_proof_vectors` (10), `d5_capacity_estimate_vectors` (21),
`d5_inherited_transfer_vectors` (13), `d5_redeem_vectors` (14), `d5_scope_open_vectors`
(10), `d5_specimen_fixture` (7), `protection_window_golden`, `real_daemon`.

The hermetic side holds too, run per-file to get around the stale manifest:
`tests/rust-steady-state-byte-identity.test.ts` passes under `MC_E2E_MODE=rust`
("serves byte-identical wire bodies across defer passes with no new content", 37
assertions), as does `tests/rust-memory-update-reembed.test.ts` (199 s). Note the
limitation in F1.1: because this branch is behind `gate/f1-rebase`, these runs are against
`e76a1bc`'s host, not `c5542043`'s.

**The `producer_attempt` / meta-bytes distinction, stated plainly.** Durable bytes DO change
at `off`, and the slice report does not say so:
`publish_validated_chunk` now times every committed publish and writes
`last_publish_duration_us` / `max_publish_duration_us` / `publish_sample_count` into
`mc_pass_trace` on **every** publish regardless of mode
(`crates/mc-module/src/historian.rs:857-870`), and mc-store migration 59 adds those columns
to every store on open. `session.status` gains a `single_store` block and a
`publish_timing` block (`crates/mc-module/src/lib.rs:7523-7524`). So: *no served wire byte
moves; `store.db` bytes and the status payload do.*

### F1.1 (note) — the branch is not on the gate tip it claims

The brief names the base as `gate/f1-rebase` @ `c5542043`. `84d899be`'s parent is
`e76a1bcb`, four commits behind: `a029ca19`, `6f127b7e`, `bcf71187`, `c5542043`. Two of
those matter here. `6f127b7e` changes
`packages/plugin/src/hooks/magic-context/inject-compartments.ts` — an m0/m1 render source,
i.e. on the wire path — so "byte-identical to `c5542043`" cannot be asserted from this
branch without a rebase. And `bcf71187` adds the 16 lines to
`packages/e2e-tests/mode-manifest.json` that the slice report says blocked the hermetic
e2e: **the manifest repair the slice was waiting for is already on `gate/f1-rebase`, it is
just not on this branch.** Rebase before merging, then re-run §6.

---

## 2. The privilege flip is unobservable

**Held, under three harder arrangements than the slice's own test.**

| Arrangement | Test | Result |
| --- | --- | --- |
| Fast poller + concurrent `wal_checkpoint(PASSIVE)` through 12 multi-chunk publishes | `the_privilege_flip_stays_invisible_under_wal_checkpoint_pressure` | never armed; row 0 afterwards |
| A `BEGIN DEFERRED` read snapshot pinned before the fold and held to the end, sampled 200× inside it | `a_read_transaction_held_across_the_whole_publish_never_sees_the_flip` | never armed; the same snapshot also sees zero compartments of the fold, which is the reader-side half of the visibility invariant |
| Writer loses the busy timeout against a held `BEGIN IMMEDIATE` | `a_publish_that_loses_the_busy_timeout_leaves_nothing_behind` | fails after 5.47 s; row 0; no memories; no fold |

The held-snapshot case is the one worth keeping: a poller takes a fresh snapshot per
statement and can only *miss* the flip, while a pinned snapshot would expose it if the
armed value were ever committed. It is not.

### F2.1 (pin, low) — a lost busy timeout is not a typed refusal

`host_store.rs:217-229` gives every schema refusal a stable code, and
`is_schema_refusal()` (`:234-242`) lets a health reader separate "the host migrated past
me" from "something went wrong here". A busy-timeout loss lands in
`HostStoreError::Sqlite` → `single_store_sqlite_error`, indistinguishable from corruption,
an I/O error or a constraint violation. Observed string: `context.db write failed: database
is locked`. B5's proof bar asks for "a seat-refusal counter under a concurrent fold"; the
error taxonomy cannot currently produce one.

**Fix:** map `SQLITE_BUSY`/`SQLITE_BUSY_TIMEOUT` to its own variant and code
(`single_store_busy`), and count it.

### F2.2 (note) — the privilege row is still file-global

`with_privileged_transaction` writes `context_privilege_state(id = 1)`
(`host_store.rs:822-826`), the v71 file-global row. §7B **B9** ruled that single-store gets
its own durable predicate keyed by `(project_path, domain)`, with the guard rebuild folded
into B0. B1 therefore leans on a predicate B9 says will not be the fence. Isolation makes
it unobservable *today*, which is what §2 proves; it does not make it the scoped predicate
B9 requires. Not a B1 defect — a B0/B2 dependency this slice has taken on without naming
it. Also note `:844-847` unconditionally clears the row to 0 at the end of every bracket,
so a module publish silently repairs a row some other crashed writer left armed. That is
probably desirable, and it is undocumented.

---

## 3. The fingerprint fence

**Four positives, executed:**

| Change | Test | Result |
| --- | --- | --- |
| Column added to a domain table | `host_store::tests::a_column_added_to_a_domain_table…` (slice's) | refuses that table |
| Trigger-only change | `host_store::tests::a_trigger_only_change…` (slice's) | refuses that table |
| **Index-only change** (new) | `an_index_only_change_to_a_domain_table_is_caught_by_the_fingerprint` | refuses `memories` with `single_store_fingerprint_mismatch`; leaves `compartments` writable |
| **Host migration between two module writes** (new) | `a_host_migration_between_two_module_writes_refuses_the_second` | second publish refuses `single_store_fence_ahead`; no rows, no fold, row disarmed |
| **Host migration landing mid-publish** (new) | `a_migration_landing_between_chunks_refuses_the_rest_and_leaves_the_staged_rows` | refuses the remaining chunks; fold never visible |

`read_table_fingerprint` keys on `tbl_name` (`host_store.rs:363-399`), which is what makes
the index case work without any index-specific code.

**The negative, executed:** `a_change_to_a_table_the_module_does_not_write_refuses_nothing`
adds a column, an index, a trigger and a whole new table to `pending_ops` (a non-domain
table) and asserts all nine domain tables stay writable and a real publish still lands. It
does. The fingerprint half of the fence is correctly narrow.

### F3.1 (pin, medium) — the *lane* half of the fence is as broad as it can be

`check_table` calls `check_lane` first (`host_store.rs:463-464`), and `check_lane` refuses
when `persisted > built` for the whole file (`:451-459`). Executed in
`any_host_migration_at_all_refuses_every_domain_table`: a migration that creates a table the
module has never heard of, with no domain table touched at all, refuses **every** domain
write with `single_store_fence_ahead`, and `writable_tables()` returns `Err` rather than a
list.

This is the #14025 coordinated-window contract taken literally and it is defensible. What
is not stated anywhere is its operational consequence at `on`: **any** upstream
`context.db` migration — a dashboard feature, a `pending_ops` index, anything — stops the
module writing folds until a new module binary is placed. The slice report's "Refusal
granularity: per table" (§"The fingerprint rule as implemented", point 4) is true only for
fingerprint drift; for a lane move the granularity is the whole file.

**Fix:** either state the blast radius in the release notes and the B2 runbook as "every
upstream migration is a module-rebuild window", or split the lane check so a table whose
fingerprint still matches stays writable on a lane move, and reserve whole-file refusal for
a lane move that also changes a domain fingerprint. The second is a design change and
belongs to B2, not to B1.

### F3.2 (pin, medium) — "no partial write" does not survive a mid-publish migration

The claim under test was "each produce the typed refusal … and no partial write". The typed
refusal holds. "No partial write" does not, at the granularity of a publish.
`a_migration_landing_between_chunks_refuses_the_rest_and_leaves_the_staged_rows` spins a
second connection that lands `schema_migrations` v90 in the window between two of the
module's own chunks. Observed: the migration committed after 1 memory row, the publish
failed `single_store_fence_ahead`, and **that 1 staged memory row is still in `context.db`
with no fold it belongs to and nothing that will ever clean it up**. Re-running the publish
after the rebuild then re-writes the standalone rows a second time (F4.1).

`publish_fold` (`host_store.rs:1388-1416`) has no compensation, no staging table and no
`publish_seq`; §7B **B10**'s "next boot's sweep deletes rows above the admitted watermark"
is exactly the piece the slice deferred, and this is the hole it leaves.

**Fix:** B2 cannot turn `on` without either (a) B10's `publish_seq` + boot sweep, or (b) a
publish identity the staged writers upsert on so a partial publish is idempotent to redo.
(b) is the smaller change and is the same fix F4.1 needs.

---

## 4. Visibility under crash

**Held, proved with real process kills.** `a_process_killed_mid_publish_leaves_either_the_pre_fold_state_or_the_whole_fold`
re-executes the test binary as a child (`child_publish_for_the_kill_test`), times one clean
publish first, then kills the child with SIGKILL at 14 delays spread across and past that
duration, on a database that already holds a prior fold. Every attempt:

- the privilege row is 0;
- the prior fold is undamaged;
- either the new session has **no** compartments, **no** facts and **no** events, or it has
  all 2 compartments, its fact and its event.

Observed: 9 kills landed before the fold, 5 after it. Both sides of the disjunction were
exercised — the test asserts that, so it cannot quietly degrade into a one-sided proof.

So "the last chunk is atomic" holds. The second half of the claim — "the standalone rows
before it are idempotent on retry" — does not.

### F4.1 (PIN, high) — a retry is neither a resume nor a discard

`a_retried_publish_duplicates_its_standalone_rows_then_dies_on_a_constraint` runs the same
publish twice through two fresh handles. Observed, exactly:

| Writer | Line | Retry behaviour |
| --- | --- | --- |
| `insert_notes` | `host_store.rs:1021-1039` | plain `INSERT`, no key, no upsert → **2 rows** |
| `insert_user_observations` | `host_store.rs:1117-1143` | plain `INSERT` → **2 rows** |
| `insert_user_memories` | `host_store.rs:1186-1214` | plain `INSERT` → duplicates (same shape) |
| `insert_memories` | `host_store.rs:969-1019` | deduplicates on content, but bumps `seen_count` → row count right, **`seen_count` = 2** |
| `insert_primer_candidates` | `host_store.rs:1065-1111` | upserts on its source range → **1 row**, correct |
| `insert_compartments` | `host_store.rs:864-898` | plain `INSERT` into a table with `UNIQUE(session_id, sequence)` → the visibility chunk **aborts with a raw SQLite constraint error** |

The order is what makes this sharp: the staged chunks commit their duplicates *first*, and
only then does the visibility chunk hit the uniqueness constraint and fail the publish with
`single_store_sqlite_error`. So a retried publish leaves duplicated notes and observations,
inflated `seen_count`, and reports an untyped failure.

The slice report's "Crash between chunks leaves the standalone rows and no fold. That is
the pre-fold state for every reader that composes history" is true for a *reader*. It is
not a statement about recovery, and there is no recovery.

**Fix:** give `notes`, `user_memory_candidates` and `user_memories` the idempotency
`primer_candidates` already has (a natural key plus `ON CONFLICT DO UPDATE`), make
`insert_memories` skip the `seen_count` bump when the row it found was written by this same
publish instant, and make `insert_compartments` upsert on `(session_id, sequence)` — or
delete-and-replace like the host does (F5.1). Until then B2 must treat a failed publish as
unretriable.

### F4.2 (note) — `foreign_keys = ON` is set; nothing exercises a cascade

`host_store.rs:702-706` enables foreign keys with a good reason in the comment. No test in
the slice or this gate makes a cascade fire from a module connection. Cheap to add; worth
adding before `on`.

---

## 5. Golden completeness

The brief's premise needs one correction before the answer: **`scripts/single-store-golden.ts`
does not use a column list.** `readTable` is `SELECT *` (`:281-283`) and `diffTables`
compares the union of both rows' keys (`:315-322`). Inside the six tables it names
(`:48-59`) it compares **every column, including `id`, every timestamp, every embedding
column and `harness`.** Confirmed by mutation (below).

There is a *second*, narrower comparison — `shadow_compare_columns`
(`host_store.rs:1544-1605`) — which is the one that runs in `shadow` mode against a real
`context.db`, and that one does have exclusions. Both are inventoried here.

### What the golden does not compare

**(a) Three domain tables, entirely.** `notes` (33 columns), `user_memories` (8), and
`memory_embedding_watermarks` (4) are absent from `COMPARED`. The slice declares `notes`
and `user_memories` ("unit-tested only; not in the golden publish"); it does not declare
that the golden is structurally unable to notice them.

*Mutation (undefended):* added a `notes` row to the module publish only
(`scripts/single-store-golden.ts:249`). Golden stayed green, exit 0. Restored.

**(b) Everything outside those six tables that a host memory write touches.** Not
compared, and not in `DOMAIN_TABLES` (`host_store.rs:78-88`) so not fingerprinted either:
`memories_fts` and its shadow tables, `memory_embeddings`, `memory_mutation_log`,
`m0_mutation_log`, `domain_mutation_epoch`, `context_privilege_state`, and — see F5.1 —
`session_meta`.

**(c) Two values are handed to both writers, so their columns can never diverge.** The
frozen clock (`NOW_MS`, `:45`, `:151-152`) covers `created_at`, `updated_at`,
`first_seen_at`, `last_seen_at`, `promoted_at`, `source_message_time`; and `harness`
(`:206`, `:339-340`) covers `compartments.harness`, `session_facts.harness`,
`compartment_events.harness`, `primer_candidates.harness`. That is declared in the script's
header and in the slice report, and it is the right call for a writer comparison. See F5.2
for what it costs.

**(d) Columns that are compared but vacuously**, because neither writer sets them in this
fixture and both take the table default: `compartments.p1_embedding`,
`compartments.p1_embedding_model_id`, `compartments.rebase_status`; `memories.scope`,
`shareable`, `retrieval_count`, `last_retrieved_at`, `verified_at`, `classified_at`,
`superseded_by_memory_id`, `merged_from`, `mural_cue`, `mural_cue_hash`, `mural_cue_at`,
`mural_cue_rejection_count`; `primer_candidates.question_embedding`,
`question_embedding_model_id`. A divergence in any of these would matter at `on` only if a
future host writer started setting one; today the comparison is real but carries no
information.

*Mutation (reddened):* changed the module's memory `seen_count` literal from 1 to 2
(`host_store.rs:988`). Golden reported `memories[0].seen_count: ts=1 module=2` and
`memories[1].seen_count: ts=1 module=2`, and nothing else. Restored. So the comparison is
live for the non-default columns.

### What `shadow_compare_columns` additionally omits

These columns have **no** cross-implementation proof at all: they are outside the shadow
comparison, and their tables are outside the golden.

- `user_memories.source_candidate_provenance` — the one nontrivial JSON the module builds
  (`user_memory_provenance`, `host_store.rs:1147-1184`), including the "NULL rather than
  `[]` when candidates were given but none found" rule at `:1177-1182`. Nothing compares it
  against the host.
- `notes.anchor_ordinal`, `notes.created_at`, `notes.updated_at`, `notes.project_path`.
- `compartment_events.compartment_id` — the resolved foreign key, the other nontrivial
  computation (`host_store.rs:945-949`). The TS golden *does* compare it (`SELECT *`), so
  this one is covered once, by the golden only.
- `memories.first_seen_at`/`created_at`/`updated_at`/`last_seen_at`, and the rest of the
  (d) list; `primer_candidates.created_at`; `user_memory_candidates.created_at`;
  `compartments` autoincrement ids (excluded on purpose, `:1541-1543`).

### F5.1 (PIN, high) — undeclared divergence: the module appends compartments, the host replaces them, and the module never clears the m0/m1 cache

The host's compartment writer is `replaceAllCompartmentState`
(`packages/plugin/src/features/magic-context/compartment-storage.ts:381-397`). In one
transaction it does three things:

1. `DELETE FROM compartments WHERE session_id = ?`
2. `DELETE FROM session_facts WHERE session_id = ?` + reinsert
3. `clearCachedM0M1(db, sessionId)`

The module's visibility chunk (`apply_chunk`, `host_store.rs:1472-1477`) does (2) —
`replace_session_facts` is a faithful delete-and-reinsert — and does **not** do (1) or (3).

*(1)* is why F4.1's retry dies on `UNIQUE(session_id, sequence)`: the two writers have
different semantics for the same table, and the golden cannot see it because its fixture
has no pre-existing compartments for the session. Any republish of a session the host has
already folded behaves differently under the two writers.

*(3)* is an `UPDATE` on `session_meta` that nulls 20+ `cached_m0_*` / `cached_m1_*` columns
(`packages/plugin/src/features/magic-context/storage-meta-shared.ts:560-604`).
`session_meta` is not a domain table, is not fingerprinted, and is in neither comparison.
The practical exposure is smaller than it looks — the m0 cache is re-validated against live
markers (`maxCompartmentSeq`, `maxMemoryId`, …,
`inject-compartments.ts:1513-1544`), so a module-written compartment does change the marker
and does invalidate — but "a reader-side invariant happens to cover it" is a different
claim from the one the writer inventory makes, and it is reader-side work this slice does
not own, exactly like B10.

**Fix:** either make the module's visibility chunk perform the host's delete-and-replace
and the `session_meta` clear, or declare in the writer inventory that `session_meta` is a
host-only side effect and prove the marker path covers it. Add `session_meta` to the
fingerprint set if the module ever writes it.

Related and smaller: `insertMemory` also calls `invalidateProject()`
(`storage-memory.ts:651`), an in-process cache invalidation the module cannot perform from
another process at all.

### F5.2 (PIN, medium) — the declared `harness` divergence is a duplicate row, not a diverging column

The slice declares that `fold_publish_view` passes `harness: "module"`
(`crates/mc-module/src/historian.rs:171`) and that shadow will report `harness` as
diverging. Quantified by mutation:

*Mutation (reddened):* handed `"module"` to the module publish instead of the host's label
(`scripts/single-store-golden.ts:340`). Golden exit 1, 7 diverging columns:
`compartments[0..1].harness`, `session_facts[0..1].harness`,
`compartment_events[0..1].harness`, `primer_candidates[0].harness`. Restored.

The last one is not cosmetic. `primer_candidates`' upsert key is
`(project_path, harness, session_id, source_start_message_id, source_end_message_id)`
(`host_store.rs:1079-1080`). With `harness = 'module'` the module does not upsert the host's
row — it **inserts a second candidate row for the same question and the same source range**,
which is precisely the "two askings of the same question" collision the slice's own
`normalize_primer_question` fix exists to prevent. The slice report calls this item "shadow
will report `harness` as diverging on every row"; it is more than that.

---

## 6. Watermark drain

**Executed** in `single-store-embedding-drain-gate.test.ts`, with a configured, loaded,
failing provider (an outage, not a misconfiguration).

### F6.1 (PIN, medium) — one outage retires the watermark permanently

`drainSingleStoreEmbeddingWatermarks` treats `count === 0` from the embedder as "nothing
left to embed" and advances `embedded_memory_id` to `written_memory_id`
(`packages/plugin/src/features/magic-context/memory/single-store-embedding-drain.ts:74-80`).
`embedUnembeddedMemoriesForProject` returns `0` on **four** different conditions
(`packages/plugin/src/features/magic-context/project-embedding-registry.ts:2564` provider
disabled, `:2570` nothing pending, `:2584` provider returned no result, `:2612-2615` the
provider threw and the error was swallowed). Only one of those four means "done".

Observed, with three module-written memories and the provider down:

- the drain returns 0;
- all three rows are still unembedded;
- `embedded_memory_id` has advanced past all three;
- `getPendingEmbeddingWatermarks` is empty — the mark will never ask again;
- when the provider comes back, further drains are no-ops and the rows stay unembedded;
- `embedUnembeddedMemoriesForProject` called directly still finds and embeds all three.

So the answer to "how long do they stay unembedded" is: **until the next ordinary project
sweep with the provider up** — `runProjectMaintenance` on the dream timer's startup and
interval passes (`packages/plugin/src/plugin/dream-timer.ts:400-410`), or the next
`ctx_memory` write on that project (`packages/plugin/src/hooks/magic-context/hook.ts:985`).
Not "until the next unrelated write", but close: the watermark's own recovery path is gone
after one outage, and what saves the rows is machinery that predates this slice and is
unaware of it.

The happy path does resume correctly: with 14 module-written memories and a batch size of
10, the first drain embeds 10, leaves the mark where it was because rows are still pending
below it, and the second drain embeds the remaining 4 and then advances. That is tested
too.

**Fix:** have the embedder distinguish "embedded nothing because there was nothing" from
"embedded nothing because the call failed" (return `null` vs `0`, or surface the throw) and
only advance on the former. Cheap and local.

### F6.2 (PIN, medium) — the drain only runs when a *mirror pull* is due

The wiring is inside `if ((memoryMirrorDue || compartmentMirrorDue) && !state.mirrorProjectionInFlight)`
and inside the `if (memoryMirrorDue)` arm
(`packages/plugin/src/hooks/magic-context/rust-mode-transform.ts:3806-3831`).
`memoryMirrorDue` requires `options.moduleClient.mirrorPull !== undefined` and a changed
mirror projection key (`:3798-3802`). The slice report says the drain is "wired into
`rust-mode-transform.ts` beside the mirror re-embed that already runs there, so it is on
the path rust mode actually takes" — true today, and it is the *mirror's* path, not
single-store's. B3 deletes the domain-mirror paths. When it does, this drain's only trigger
disappears with them.

**Fix:** B2 should hoist the drain out of the `memoryMirrorDue` branch to its own
due-check keyed on the watermark table, before B3 removes the branch.

### F6.3 (PIN, medium) — §7C's hermetic confirmation is not blocked, it is unreachable in this build

The slice reports the confirmation as blocked by the stale mode manifest. I ran the
hermetic rust e2e per-file instead, and the manifest is not the obstacle.

`tests/rust-memory-update-reembed.test.ts` passes per-file under `MC_E2E_MODE=rust`
(199 s, 1 pass / 0 fail), and it drives the exact branch the drain is wired into. But the
drain can only ever be a no-op in this build, for a structural reason: the only writer of
`memory_embedding_watermarks` is `raise_embedding_watermark`
(`host_store.rs:1225-1246`), reachable only from `publish_fold`. At `off` `publish_fold`
never runs; at `shadow` it runs against the `VACUUM INTO` **scratch copy**
(`host_store.rs:1781-1784`), so the row lands in the scratch file and the real
`context.db` never gets one; at `on` it is refused. Therefore no hermetic run of this
binary can ever put the drain in a state where it has work to do.

So the answer to §7C is not "blocked on the manifest" but "cannot be answered before B2".
The confirmation the design asked for needs either `on`, or a shadow mode that also raises
the watermark on the real file (which would make shadow no longer write-free and is
probably the wrong trade), or a test that seeds a watermark row by hand and asserts the
rust-mode pass drains it. The third is cheap and is what B2 should ship.

As noted in F1.1 the manifest repair is already on `gate/f1-rebase` @ `bcf71187`; this
branch is simply behind it, so the group invocation still refuses here.

---

## 7. Chunk budget

**The slice's table reproduces on this machine.** `cargo test -p mc-module --lib
host_store::tests::measure -- --ignored --nocapture`:

| rows | slice report | this machine |
| --- | --- | --- |
| 16 | 3,182 µs | 2,843 µs |
| 32 | 3,854 | 3,012 |
| 64 | 5,855 | 6,785 |
| 128 | 10,005 | 9,585 |
| 256 | 20,973 | 24,987 |
| 512 | 66,820 | 70,647 |
| 1024 | 191,441 | 158,872 |

`the_shipped_chunk_budget_holds_its_wall_clock_ceiling` printed
`rows=64 worst_chunk_us=5451 budget_us=250000`.

### F7.1 (PIN, high) — the measurement was taken on an empty database, and the number moves by 25× on a small one

Both instruments build their fixture from the schema snapshot seconds earlier: no memories,
an empty FTS5 index, a cold WAL (`host_store.rs:3215-3217`, `:3171-3173`). A real
`context.db` never looks like that, and FTS5 segment-merge cost — the very thing the slice
identifies as the source of superlinearity — is a function of how much is already indexed.

`single_store_gate.rs::measure_chunk_cost_on_a_seeded_store` seeds the store first
(`cargo test -p mc-module --test single_store_gate -- --ignored --nocapture`). Worst staged
chunk, as a percentage of the 5 s `busy_timeout`:

| rows | 0 seeded | 640 seeded | 6,400 seeded |
| --- | --- | --- | --- |
| 16 | 2,156 µs (0.043%) | 4,366 µs (0.087%) | 17,427 µs (0.349%) |
| 32 | 2,755 (0.055%) | 6,166 (0.123%) | 84,188 (1.684%) |
| **64** | **4,267 (0.085%)** | **9,975 (0.199%)** | **104,767 (2.095%)** |
| 128 | 8,773 (0.175%) | 29,174 (0.583%) | 199,328 (3.987%) |
| 256 | 29,744 (0.595%) | 76,041 (1.521%) | 372,488 (7.450%) |
| 512 | 77,849 (1.557%) | 195,411 (3.908%) | 693,046 (13.861%) |
| 1024 | 252,646 (5.053%) | 640,122 (12.802%) | 1,553,879 (31.078%) |

**Direct answer to the question asked:** yes — 64 rows stays under 5% of `busy_timeout`
(250 ms) on a store 10× and even 100× the fixture on this machine. But the margin collapses
from 0.085% to 2.095% between an empty store and a 6,400-memory one, a 25× degradation for
a database that is still tiny. The slice's "0.12% of the 5 s `busy_timeout`" is an
empty-database number and should not be quoted as the operating one. At 6,400 seeded rows
a 256-row chunk already exceeds `PUBLISH_CHUNK_BUDGET_US`, so
`the_shipped_chunk_budget_holds_its_wall_clock_ceiling` is not a ceiling that would catch a
budget increase on a realistic store — it would pass on the empty fixture regardless.

**Fix:** seed the fixture in `the_shipped_chunk_budget_holds_its_wall_clock_ceiling` to a
stated row count so the assertion has teeth, and re-measure against a copy of a real
`context.db` before B2 raises the budget or turns `on`.

### F7.2 (PIN, high) — the visibility chunk is not held to the budget at all

`plan_chunks` bounds the staged chunks and then unconditionally appends one
`Chunk::Visibility` carrying **every** compartment, **every** session fact and **every**
event (`host_store.rs:1325-1380`, chunk sizing at `:1298-1300`). `publish_fold` raises
`ChunkBudgetExceeded` only for `Chunk::Staged` (`:1398-1400`). So the largest single
transaction the module can take is unbounded by construction, which is the opposite of what
§6B **B5** and §7B **B12** ask for.

Executed: `the_visibility_chunk_ignores_the_row_budget` sets the budget to 8 and publishes
400 compartments, 400 facts and 400 events. Observed
`visibility_chunk_rows=1201 duration_us=3844 ceiling_us=250000` — 150× the budget, accepted
without complaint. The duration is small here because these rows drive no FTS index, but
nothing measured that and nothing bounds it.

In practice a fold is a handful of compartments, so this is a latent hazard rather than a
live one — but it is latent in the one place the design explicitly told the slice to be
bounded, and the measurement that sized the budget (memories only) does not cover this
chunk's row classes at all.

**Fix:** either state and enforce a hard compartments-per-publish ceiling, or implement
B10's `publish_seq` so the visibility chunk can itself be split (splitting it is exactly
what the current ordering forbids). Also measure the visibility chunk's row classes.

---

## 8. Reserved-gap assertion

**Both halves proved by mutation.** `RESERVED_UNMERGED_MIGRATION_VERSIONS = &[57, 58]`
(`crates/mc-store/src/lib.rs:2945`), consumed by `expected_applied_migration_versions()`
(`:22928-22932`) and guarded by `reserved_migration_numbers_are_not_shipped` (`:22969-22979`).

*Mutation D (an unreserved gap still reddens):* changed migration 56's version to 60, so 56
is no longer shipped. `fresh_and_migrated_stores_have_latest_schema` failed with
`left: [… 55, 59, 60]` vs `right: [… 55, 56, 59, 60]`;
`reserved_migration_numbers_are_not_shipped` stayed green. Restored.

*Mutation E (the assertion self-retires):* changed migration 59's version to 57, i.e. shipped
a reserved number. `reserved_migration_numbers_are_not_shipped` failed with
`migration 57 is reserved for another slice but is shipped here`, and
`fresh_and_migrated_stores_have_latest_schema` failed alongside it. Restored.

So the reservation cannot decay into a permanent hole: the moment A1 or B0 lands its
migration, the build is loudly red until the entry is removed. **This claim holds as
stated; no finding.**

### F8.1 (note) — the reservation is a two-branch handshake with no owner

The mechanism is correct and the *procedure* is unwritten: whoever merges A1 or B0 must
delete the entry from `RESERVED_UNMERGED_MIGRATION_VERSIONS`, and the only thing that tells
them so is a failing test in a crate they may not be touching. The comment at
`crates/mc-store/src/lib.rs:2919-2921` names the slices but not the removal step. One line
in the merge checklist closes it.

### F8.2 (PIN, medium) — B1 moves the `context.db` fence for a table nothing can use yet

TS migration `v89` creates `memory_embedding_watermarks`
(`packages/plugin/src/features/magic-context/migrations.ts:3097-3123`, table at `:3114`) and
`LATEST_SUPPORTED_VERSION` moves 88 → 89 (`storage-db.ts:107`). The only writer of that
table is `raise_embedding_watermark` (`host_store.rs:1225-1246`), reachable only from
`publish_fold`, reachable in production only in `shadow` (scratch copy) or `on` (refused).
So **v89 is fence-moving today and behaviour-bearing only after B2.** Per §7B **B11** that
is the standard #9597 cost — but the design assigned the fence-moving role to **B0**, which
has not merged, and `BUILT_CONTEXT_FENCE_VERSION = 89` is now baked into the module
(`host_store.rs:61`).

Two consequences to schedule, not to fix here:

1. If B0 lands its own TS migration at 89, the merge has two v89s. If it lands at 90+, this
   module's fence constant is immediately behind and — per F3.1 — every domain table
   refuses. Harmless while `on` is refused; it means the first thing B2 does is bump a
   constant and re-bake nine fingerprints.
2. The rollback floor named in the release notes has to be B1's release, not B0's.

---

## The pin list, in the order B2 has to clear it

| # | Severity | What | Where |
| --- | --- | --- | --- |
| F4.1 | high | staged writers are not idempotent; a retry duplicates and then dies on a constraint | `host_store.rs:1021`, `:1117`, `:1186`, `:864`, `:969` |
| F7.2 | high | the visibility chunk ignores the row budget entirely | `host_store.rs:1325-1400` |
| F7.1 | high | the chunk budget was measured on an empty database; 25× worse at 6,400 rows | `host_store.rs:3171`, `:3215` |
| F5.1 | high | module appends compartments where the host replaces them, and never clears the m0/m1 cache | `host_store.rs:1472`, `compartment-storage.ts:381` |
| F3.2 | medium | a refused mid-publish leaves staged rows nobody cleans up | `host_store.rs:1388-1416` |
| F5.2 | medium | `harness = "module"` makes the module insert a duplicate primer candidate, not just a diverging column | `historian.rs:171`, `host_store.rs:1079` |
| F6.1 | medium | one provider outage retires the embedding watermark permanently | `single-store-embedding-drain.ts:74-80` |
| F6.2 | medium | the drain fires only when a mirror pull is due; B3 deletes that trigger | `rust-mode-transform.ts:3806-3831` |
| F3.1 | medium | any upstream migration refuses every domain table | `host_store.rs:451-464` |
| F6.3 | medium | §7C's drain confirmation cannot be reached before B2, manifest or no manifest | `host_store.rs:1225`, `:1781` |
| F8.2 | medium | B1 moves the fence that B0 was supposed to move | `host_store.rs:61`, `migrations.ts:3098` |
| F2.1 | low | a lost busy timeout is not a typed refusal | `host_store.rs:217-242` |
| F1.1 | note | the branch is four commits behind `gate/f1-rebase`, including the manifest repair | — |
| F2.2 | note | the privilege row is still the file-global v71 row B9 replaces | `host_store.rs:822` |
| F4.2 | note | `foreign_keys = ON` is set and never exercised | `host_store.rs:702` |
| F8.1 | note | the migration reservation has no documented removal step | `mc-store/src/lib.rs:2919` |

None of these is reachable at `single_store = off`. All of F4.1, F7.2, F5.1 and F3.2 must
close before `on` is admitted.
