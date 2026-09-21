//! Adversarial tests for the single-store writers in `mc_module::host_store`, which write
//! the host's `context.db` domain tables directly.
//!
//! These are not the writers' own unit tests re-run. Each one takes a property those
//! writers claim and tries to break it with the most demanding arrangement the public API
//! allows: a WAL checkpoint running through a publish, a reader holding its snapshot
//! across the whole fold, a writer whose busy timeout expires, a host migration landing
//! between two of the module's own chunks, and a real process killed mid-publish.
//!
//! Some tests here record behaviour that is WRONG rather than right. Those say so in
//! their doc comment, along with what a fix has to change. They pass today and must be
//! inverted when the defect is fixed — a recorded defect that silently starts behaving
//! correctly is a test nobody notices has gone stale.
//!
//! Production isolation: every database is created fresh under the system temp directory
//! from the committed schema snapshot. Nothing here opens a real `context.db`.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use mc_module::host_store::{
    self, FoldPublish, HostCompartment, HostCompartmentEvent, HostMemory, HostNote,
    HostPrimerCandidate, HostSessionFact, HostStore, HostUserObservation, SingleStoreMode,
    DEFAULT_PUBLISH_CHUNK_ROWS, PUBLISH_CHUNK_BUDGET_US,
};
use rusqlite::{params, Connection};

/// The same committed schema snapshot the slice fingerprints itself against.
const SCHEMA_SNAPSHOT: &str = include_str!("fixtures/context-db-schema.sql");

const PROJECT: &str = "git:gate";

/// Tests that set process-wide environment variables cannot run beside each other.
fn env_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

fn fixture_db(dir: &Path, name: &str) -> PathBuf {
    let path = dir.join(name);
    let conn = Connection::open(&path).expect("open fixture");
    conn.execute_batch(SCHEMA_SNAPSHOT).expect("apply schema");
    // A real context.db is already in WAL, and the difference matters here: the module's
    // own open issues `PRAGMA journal_mode=WAL`, which is a WRITE that needs exclusive
    // access on a file that is not in WAL yet. A fixture left on the default journal mode
    // would make every test that holds a second connection fail for the wrong reason.
    conn.pragma_update(None, "journal_mode", "WAL")
        .expect("put the fixture in WAL, as a real context.db is");
    conn.execute(
        "INSERT OR IGNORE INTO context_privilege_state(id, enabled) VALUES (1, 0)",
        [],
    )
    .expect("seed privilege row");
    conn.execute(
        "INSERT OR REPLACE INTO authority_managed(project_path, context_store_uuid, marked_at)
         VALUES (?1, 'gate', 1)",
        params![PROJECT],
    )
    .expect("mark the project managed so the authority guards are live");
    path
}

/// A publish with `memories` project memories and `compartments` compartments.
fn publish_of(session: &str, memories: usize, compartments: usize) -> FoldPublish {
    FoldPublish {
        session_id: session.to_string(),
        project_path: PROJECT.to_string(),
        harness: "opencode".to_string(),
        now_ms: 1_700_000_000_000,
        compartments: (0..compartments)
            .map(|index| HostCompartment {
                sequence: index as i64 + 1,
                start_message: index as i64 * 4 + 1,
                end_message: index as i64 * 4 + 4,
                start_message_id: format!("msg_{index}_a"),
                end_message_id: format!("msg_{index}_d"),
                title: format!("compartment {index}"),
                content: format!("body {index}"),
                p1: Some(format!("body {index}")),
                importance: Some(60),
                created_at: 1_700_000_000_000,
                ..HostCompartment::default()
            })
            .collect(),
        facts: vec![HostSessionFact {
            category: "Decisions".to_string(),
            content: format!("{session} decided something"),
        }],
        events: vec![HostCompartmentEvent {
            kind: "causal_incident".to_string(),
            at_compartment: Some(1),
            fields_json: "{}".to_string(),
        }],
        memories: (0..memories)
            .map(|index| HostMemory {
                category: "ARCHITECTURE".to_string(),
                content: format!(
                    "{session} memory {index} with enough prose to give the full-text index real work to do"
                ),
                ..HostMemory::default()
            })
            .collect(),
        notes: vec![HostNote {
            content: format!("{session} note"),
            anchor_ordinal: Some(4),
        }],
        primer_candidates: vec![HostPrimerCandidate {
            question: "How does the fence work?".to_string(),
            source_compartment_start: Some(1),
            source_compartment_end: Some(4),
            source_start_message_id: "msg_0_a".to_string(),
            source_end_message_id: "msg_0_d".to_string(),
            source_message_time: 1_699_999_000_000,
            created_at: 1_700_000_000_000,
        }],
        user_observations: vec![HostUserObservation {
            content: "prefers terse answers".to_string(),
            source_compartment_start: Some(1),
            source_compartment_end: Some(4),
            created_at: 1_700_000_000_000,
        }],
        user_memories: Vec::new(),
        user_memory_collection_enabled: true,
    }
}

fn count(conn: &Connection, sql: &str) -> i64 {
    conn.query_row(sql, [], |row| row.get(0)).unwrap()
}

fn sha256_of(path: &Path) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(std::fs::read(path).expect("read database file"));
    format!("{:x}", hasher.finalize())
}

// ── Claim 1: off is off ─────────────────────────────────────────────────────

/// With the mode at its default, the two entry points that can reach `context.db` do not
/// touch the file — not even to read it. Proved on the bytes: an open alone would create
/// the `-wal` and `-shm` sidecars and a WAL-mode pragma would rewrite the header.
#[test]
fn off_mode_leaves_every_byte_of_context_db_alone() {
    let _guard = env_lock()
        .lock()
        .unwrap_or_else(|poison| poison.into_inner());
    let dir = tempfile::tempdir().unwrap();
    let data_home = dir.path().join("data");
    let storage = data_home.join("cortexkit").join("magic-context");
    std::fs::create_dir_all(&storage).unwrap();
    let path = fixture_db(&storage, "context.db");
    // Close the fixture's own WAL so the on-disk file is the whole database.
    {
        let conn = Connection::open(&path).unwrap();
        conn.pragma_update(None, "journal_mode", "DELETE").unwrap();
    }
    let _ = std::fs::remove_file(path.with_extension("db-wal"));
    let _ = std::fs::remove_file(path.with_extension("db-shm"));
    let before = sha256_of(&path);

    let previous_test_dir = std::env::var("MAGIC_CONTEXT_TEST_DATA_DIR").ok();
    let previous_xdg = std::env::var("XDG_DATA_HOME").ok();
    std::env::set_var("MAGIC_CONTEXT_TEST_DATA_DIR", &data_home);
    std::env::remove_var("XDG_DATA_HOME");

    host_store::set_mode(SingleStoreMode::Off);
    assert_eq!(host_store::mode(), SingleStoreMode::Off);
    assert_eq!(host_store::resolve_context_db_path(), path);

    let status = host_store::status_value();
    assert_eq!(status["mode"], "off");
    assert!(
        status["path"].is_null(),
        "off mode must not even name the file it is not opening: {status}"
    );
    assert!(
        status["fence"].is_null(),
        "off mode read the fence: {status}"
    );

    let publish = publish_of("ses_off", 3, 1);
    assert!(
        host_store::verify_publish_in_shadow(&publish).is_none(),
        "shadow verification ran while the mode was off"
    );

    match previous_test_dir {
        Some(value) => std::env::set_var("MAGIC_CONTEXT_TEST_DATA_DIR", value),
        None => std::env::remove_var("MAGIC_CONTEXT_TEST_DATA_DIR"),
    }
    if let Some(value) = previous_xdg {
        std::env::set_var("XDG_DATA_HOME", value);
    }

    assert_eq!(before, sha256_of(&path), "off mode changed context.db");
    assert!(
        !path.with_extension("db-wal").exists() && !path.with_extension("db-shm").exists(),
        "off mode opened context.db: a WAL sidecar appeared beside it"
    );
}

// ── Claim 2: the privilege flip is unobservable ─────────────────────────────

/// Race the flip harder than `host_store`'s own unit test does: a second connection polls
/// the row as fast as it can while a third checkpoints the WAL underneath the publish.
///
/// A checkpoint is the interesting adversary because it is the one operation that moves
/// another transaction's pages into the main database file. If the armed row could ever
/// be observable, a checkpoint racing the commit is where it would show.
#[test]
fn the_privilege_flip_stays_invisible_under_wal_checkpoint_pressure() {
    let dir = tempfile::tempdir().unwrap();
    let path = fixture_db(dir.path(), "context.db");

    let stop = Arc::new(AtomicBool::new(false));
    let armed_sightings = Arc::new(Mutex::new(Vec::<String>::new()));

    let poll_stop = Arc::clone(&stop);
    let poll_sightings = Arc::clone(&armed_sightings);
    let poll_path = path.clone();
    let poller = std::thread::spawn(move || {
        let conn = Connection::open(&poll_path).unwrap();
        conn.busy_timeout(Duration::from_millis(5_000)).unwrap();
        let mut samples = 0_u64;
        while !poll_stop.load(Ordering::Relaxed) {
            let enabled: i64 = conn
                .query_row(
                    "SELECT COALESCE((SELECT enabled FROM context_privilege_state WHERE id = 1), 0)",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            samples += 1;
            if enabled != 0 {
                poll_sightings
                    .lock()
                    .unwrap()
                    .push(format!("sample {samples} read enabled={enabled}"));
            }
        }
        samples
    });

    let checkpoint_stop = Arc::clone(&stop);
    let checkpoint_path = path.clone();
    let checkpointer = std::thread::spawn(move || {
        let conn = Connection::open(&checkpoint_path).unwrap();
        conn.busy_timeout(Duration::from_millis(5_000)).unwrap();
        let mut checkpoints = 0_u64;
        while !checkpoint_stop.load(Ordering::Relaxed) {
            // PASSIVE so the checkpointer never blocks the writer: the point is to have
            // it running through the publish, not to serialise against it.
            if conn
                .query_row("PRAGMA wal_checkpoint(PASSIVE)", [], |row| {
                    row.get::<_, i64>(0)
                })
                .is_ok()
            {
                checkpoints += 1;
            }
            std::thread::sleep(Duration::from_micros(200));
        }
        checkpoints
    });

    let mut store = HostStore::open(&path).unwrap();
    store.set_chunk_budget(1);
    for round in 0..12 {
        let publish = publish_of(&format!("ses_{round}"), 6, 2);
        store.publish_fold(&publish).unwrap();
    }
    stop.store(true, Ordering::Relaxed);
    let samples = poller.join().unwrap();
    let checkpoints = checkpointer.join().unwrap();

    assert!(samples > 100, "the poller barely sampled: {samples}");
    assert!(checkpoints > 0, "no checkpoint ran during the publish");
    let sightings = armed_sightings.lock().unwrap();
    assert!(
        sightings.is_empty(),
        "a second connection saw the privilege row armed: {sightings:?}"
    );

    let conn = Connection::open(&path).unwrap();
    assert_eq!(
        count(
            &conn,
            "SELECT enabled FROM context_privilege_state WHERE id = 1"
        ),
        0,
        "the privilege row was left armed after the publishes"
    );
}

/// A reader that opens its snapshot before the fold and holds it to the end sees the
/// row disarmed at every point inside that snapshot, and still disarmed after it ends.
///
/// This is the stronger version of the polling test: a poller takes a fresh snapshot per
/// statement and can only miss the flip, while a held read transaction is pinned to one
/// point in time and would expose the flip if it were ever committed.
#[test]
fn a_read_transaction_held_across_the_whole_publish_never_sees_the_flip() {
    let dir = tempfile::tempdir().unwrap();
    let path = fixture_db(dir.path(), "context.db");

    let reader = Connection::open(&path).unwrap();
    reader.busy_timeout(Duration::from_millis(5_000)).unwrap();
    // BEGIN DEFERRED plus a read is what pins the snapshot; BEGIN alone defers that
    // until the first statement and would not hold anything across the publish.
    reader.execute_batch("BEGIN DEFERRED").unwrap();
    let opening: i64 = reader
        .query_row(
            "SELECT COALESCE((SELECT enabled FROM context_privilege_state WHERE id = 1), 0)",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(opening, 0);

    let mut store = HostStore::open(&path).unwrap();
    store.set_chunk_budget(2);
    let publish = publish_of("ses_snapshot", 20, 2);
    store.publish_fold(&publish).unwrap();

    let mut inside = Vec::new();
    for _ in 0..200 {
        inside.push(
            reader
                .query_row(
                    "SELECT COALESCE((SELECT enabled FROM context_privilege_state WHERE id = 1), 0)",
                    [],
                    |row| row.get::<_, i64>(0),
                )
                .unwrap(),
        );
    }
    // The held snapshot also proves the visibility invariant from the reader's side: it
    // opened before the fold, so it must still see no fold at all.
    let compartments_in_snapshot: i64 = reader
        .query_row(
            "SELECT COUNT(*) FROM compartments WHERE session_id = 'ses_snapshot'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    reader.execute_batch("COMMIT").unwrap();

    assert!(
        inside.iter().all(|value| *value == 0),
        "a held read snapshot observed the privilege row armed: {inside:?}"
    );
    assert_eq!(
        compartments_in_snapshot, 0,
        "a snapshot taken before the fold saw the fold's compartments"
    );

    let after: i64 = reader
        .query_row(
            "SELECT COALESCE((SELECT enabled FROM context_privilege_state WHERE id = 1), 0)",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(after, 0, "the privilege row was left armed after the fold");
}

/// A publish whose busy timeout expires against another writer fails, and leaves both the
/// privilege row disarmed and none of its rows behind.
///
/// The module deliberately does not raise `busy_timeout` above the five seconds every
/// other writer on the file uses: when a chunk cannot fit, the chunk is supposed to
/// shrink rather than the timeout grow. So losing the wait is an expected outcome, and
/// the property that matters is that giving up is clean.
#[test]
fn a_publish_that_loses_the_busy_timeout_leaves_nothing_behind() {
    let dir = tempfile::tempdir().unwrap();
    let path = fixture_db(dir.path(), "context.db");

    let mut store = HostStore::open(&path).unwrap();
    store.set_chunk_budget(4);

    // Another writer holds the write lock for longer than the module's five-second
    // tolerance, so the module's very first BEGIN IMMEDIATE cannot be granted.
    let blocker = Connection::open(&path).unwrap();
    blocker.busy_timeout(Duration::from_millis(500)).unwrap();
    // BEGIN IMMEDIATE takes the write lock straight away, which is the whole point: no
    // statement is needed to make the module's own BEGIN IMMEDIATE wait for it.
    blocker.execute_batch("BEGIN IMMEDIATE").unwrap();

    let started = Instant::now();
    let outcome = store.publish_fold(&publish_of("ses_busy", 10, 2));
    let waited = started.elapsed();
    blocker.execute_batch("ROLLBACK").unwrap();

    let error = outcome.expect_err("the publish must fail when it cannot take the write lock");
    assert!(
        waited >= Duration::from_millis(4_500),
        "the module gave up after {waited:?}, well short of the five-second tolerance it claims"
    );
    println!(
        "busy-timeout gate: publish failed after {waited:?} with {error} ({})",
        error.code()
    );

    let conn = Connection::open(&path).unwrap();
    assert_eq!(
        count(
            &conn,
            "SELECT enabled FROM context_privilege_state WHERE id = 1"
        ),
        0,
        "a publish that lost the busy timeout left the privilege row armed"
    );
    assert_eq!(
        count(&conn, "SELECT COUNT(*) FROM memories"),
        0,
        "a publish that lost the busy timeout left memory rows behind"
    );
    assert_eq!(
        count(
            &conn,
            "SELECT COUNT(*) FROM compartments WHERE session_id = 'ses_busy'"
        ),
        0,
        "a publish that lost the busy timeout left a fold behind"
    );
}

// ── Claim 3: the fingerprint fence ──────────────────────────────────────────

/// An index added to a domain table changes that table's fingerprint.
///
/// `host_store`'s own tests cover a trigger-only change and a column change. An index is
/// the third schema shape the `tbl_name` query is supposed to gather, and it is the one a
/// performance migration ships most often.
#[test]
fn an_index_only_change_to_a_domain_table_is_caught_by_the_fingerprint() {
    let dir = tempfile::tempdir().unwrap();
    let path = fixture_db(dir.path(), "context.db");
    {
        let conn = Connection::open(&path).unwrap();
        conn.execute_batch("CREATE INDEX idx_gate_memories_category ON memories(category)")
            .unwrap();
    }

    let store = HostStore::open(&path).unwrap();
    let writable = store.writable_tables().unwrap();
    assert!(
        !writable.contains(&"memories"),
        "an index-only migration on memories left it writable: {writable:?}"
    );
    assert!(
        writable.contains(&"compartments"),
        "an index on memories must not refuse an unrelated domain table: {writable:?}"
    );
    let health = store.health_value(SingleStoreMode::Shadow);
    assert_eq!(
        health["tables"]["memories"]["error_code"],
        "single_store_fingerprint_mismatch"
    );
}

/// The negative that matters more than the positives: a change to a table the module
/// never writes must not refuse anything.
///
/// An over-broad fence is worse than a narrow one here. Every host migration that
/// touches a non-domain table would wedge the module on every domain table, which turns
/// an ordinary release into an outage.
#[test]
fn a_change_to_a_table_the_module_does_not_write_refuses_nothing() {
    let dir = tempfile::tempdir().unwrap();
    let path = fixture_db(dir.path(), "context.db");
    {
        let conn = Connection::open(&path).unwrap();
        conn.execute_batch(
            "ALTER TABLE pending_ops ADD COLUMN gate_unrelated_column TEXT;
             CREATE INDEX idx_gate_pending_ops_harness ON pending_ops(harness);
             CREATE TABLE gate_brand_new_table (id INTEGER PRIMARY KEY, value TEXT);
             CREATE TRIGGER gate_pending_ops_touch AFTER UPDATE ON pending_ops BEGIN
                 SELECT 1;
             END;",
        )
        .unwrap();
    }

    let mut store = HostStore::open(&path).unwrap();
    let writable = store.writable_tables().unwrap();
    assert_eq!(
        writable.len(),
        9,
        "an unrelated table's change refused a domain table: {writable:?}"
    );
    store
        .publish_fold(&publish_of("ses_unrelated", 4, 2))
        .expect("an unrelated schema change must not refuse a domain write");
}

/// The other half of that negative, and it is not reassuring: a host migration that
/// touches nothing the module writes still refuses EVERY domain table, because the lane
/// check is whole-file.
///
/// This pins the fence's blast radius as built. It is the #14025 coordinated-window
/// contract taken literally: any upstream migration, domain or not, stops the module's
/// writers until the module is rebuilt.
#[test]
fn any_host_migration_at_all_refuses_every_domain_table() {
    let dir = tempfile::tempdir().unwrap();
    let path = fixture_db(dir.path(), "context.db");
    {
        let conn = Connection::open(&path).unwrap();
        // A migration that creates a table the module has never heard of.
        conn.execute(
            "INSERT INTO schema_migrations(version, description, applied_at)
             VALUES (90, 'something unrelated to any domain table', 1)",
            [],
        )
        .unwrap();
        conn.execute_batch("CREATE TABLE gate_unrelated_v90 (id INTEGER PRIMARY KEY)")
            .unwrap();
    }

    let mut store = HostStore::open(&path).unwrap();
    let refused = store
        .writable_tables()
        .expect_err("a lane one ahead must refuse before it reports anything writable");
    assert_eq!(refused.code(), "single_store_fence_ahead");

    let error = store
        .publish_fold(&publish_of("ses_ahead", 2, 1))
        .expect_err("a lane one ahead must refuse the publish");
    assert_eq!(error.code(), "single_store_fence_ahead");

    let conn = Connection::open(&path).unwrap();
    assert_eq!(count(&conn, "SELECT COUNT(*) FROM memories"), 0);
    assert_eq!(count(&conn, "SELECT COUNT(*) FROM compartments"), 0);
}

/// A TS migration applied by the host between two module writes refuses the second one,
/// by name, with nothing half-written.
///
/// This is the ordinary shape of the hazard: the module opened the file before the host
/// migrated it, so its open-time answer is stale. The recheck inside the write
/// transaction is the only thing that catches it.
#[test]
fn a_host_migration_between_two_module_writes_refuses_the_second() {
    let dir = tempfile::tempdir().unwrap();
    let path = fixture_db(dir.path(), "context.db");

    let mut store = HostStore::open(&path).unwrap();
    store.set_chunk_budget(8);
    store
        .publish_fold(&publish_of("ses_before", 4, 2))
        .expect("the first publish lands");

    {
        let conn = Connection::open(&path).unwrap();
        conn.busy_timeout(Duration::from_millis(5_000)).unwrap();
        conn.execute_batch(
            "ALTER TABLE notes ADD COLUMN gate_v90_column TEXT;
             INSERT INTO schema_migrations(version, description, applied_at)
               VALUES (90, 'a host migration on a domain table', 1);",
        )
        .unwrap();
    }

    // The same handle, still carrying the fence it read at open.
    let error = store
        .publish_fold(&publish_of("ses_after", 4, 2))
        .expect_err("a publish after a host migration must refuse");
    assert_eq!(error.code(), "single_store_fence_ahead");

    let conn = Connection::open(&path).unwrap();
    assert_eq!(
        count(&conn, "SELECT COUNT(*) FROM memories"),
        4,
        "the refused publish wrote memory rows anyway"
    );
    assert_eq!(
        count(
            &conn,
            "SELECT COUNT(*) FROM compartments WHERE session_id = 'ses_after'"
        ),
        0,
        "the refused publish made its fold visible"
    );
    assert_eq!(
        count(
            &conn,
            "SELECT enabled FROM context_privilege_state WHERE id = 1"
        ),
        0
    );
}

/// A host migration landing between two of the module's own chunks refuses the rest of
/// the publish — and leaves the chunks that already committed in the file.
///
/// The recheck does what the design asked for: no write lands on a schema nobody checked.
/// What the design did not say, and what this pins, is the state left behind. The staged
/// rows from the committed chunks stay, the fold they belong to never becomes visible,
/// nothing cleans them up, and re-running the publish writes them again (see the retry
/// test below).
#[test]
fn a_migration_landing_between_chunks_refuses_the_rest_and_leaves_the_staged_rows() {
    let dir = tempfile::tempdir().unwrap();

    // The migration has to commit while the module is between two of its own chunks, and
    // the module reacquires the write lock straight after each commit — so a writer using
    // the ordinary busy handler can be starved for the whole publish. Spin instead, and
    // retry the whole scenario if one run loses the race outright.
    for attempt in 0..6 {
        let path = fixture_db(dir.path(), &format!("context_{attempt}.db"));
        let migrator_path = path.clone();
        let start_migrating = Arc::new(AtomicBool::new(false));
        let migrator_gate = Arc::clone(&start_migrating);
        let migrator = std::thread::spawn(move || {
            let conn = Connection::open(&migrator_path).unwrap();
            // No busy handler: this thread wants to be told "busy" instantly and try
            // again, not to sleep through the window it is waiting for.
            conn.busy_timeout(Duration::from_millis(0)).unwrap();
            while !migrator_gate.load(Ordering::Relaxed) {
                std::thread::yield_now();
            }
            let deadline = Instant::now() + Duration::from_secs(30);
            while Instant::now() < deadline {
                if conn
                    .execute(
                        "INSERT INTO schema_migrations(version, description, applied_at)
                         VALUES (90, 'a host migration landing mid-publish', 1)",
                        [],
                    )
                    .is_ok()
                {
                    let written: i64 = conn
                        .query_row("SELECT COUNT(*) FROM memories", [], |row| row.get(0))
                        .unwrap_or(-1);
                    return Some(written);
                }
                std::thread::yield_now();
            }
            None
        });

        let mut store = HostStore::open(&path).unwrap();
        // One row per chunk, so the publish is hundreds of transactions long.
        store.set_chunk_budget(1);
        start_migrating.store(true, Ordering::Relaxed);
        let outcome = store.publish_fold(&publish_of("ses_midflight", 400, 2));
        let landed = migrator.join().unwrap();

        // Either the migration never got the lock, or it got it only after the final
        // chunk had already rechecked the fence. Neither proves anything; try again.
        let (Some(landed_at), Err(error)) = (landed, outcome) else {
            continue;
        };

        assert_eq!(error.code(), "single_store_fence_ahead");
        let conn = Connection::open(&path).unwrap();
        let staged = count(&conn, "SELECT COUNT(*) FROM memories");
        assert!(
            staged > 0 && staged < 400,
            "attempt {attempt}: the migration did not land between two chunks ({staged} rows)"
        );
        assert_eq!(
            count(
                &conn,
                "SELECT COUNT(*) FROM compartments WHERE session_id = 'ses_midflight'"
            ),
            0,
            "the fold became visible despite the refusal"
        );
        assert_eq!(
            count(
                &conn,
                "SELECT enabled FROM context_privilege_state WHERE id = 1"
            ),
            0
        );
        println!(
            "mid-flight migration gate: migration committed at {landed_at} memory rows; {staged} staged rows left behind, fold not visible"
        );
        return;
    }
    panic!("the migration never landed between two chunks in six attempts");
}

// ── Claim 4: the visibility invariant, and what a retry does ────────────────

/// Kill the publishing process outright, many times, at points spread across the publish,
/// and check what a host reader can see afterwards.
///
/// A thread cannot test this: the invariant is about what survives in the file when the
/// writer stops existing, and a panicking thread still runs rusqlite's rollback. The
/// child here is this same test binary re-executed, and it is killed with SIGKILL.
#[test]
fn a_process_killed_mid_publish_leaves_either_the_pre_fold_state_or_the_whole_fold() {
    let dir = tempfile::tempdir().unwrap();
    let exe = std::env::current_exe().expect("test binary path");

    // Time one uninterrupted publish so the kill delays land inside it rather than after.
    let baseline_path = fixture_db(dir.path(), "baseline.db");
    let baseline_started = Instant::now();
    run_child_publish(&exe, &baseline_path, None);
    let full = baseline_started.elapsed();
    assert!(
        full > Duration::from_millis(30),
        "the publish finished in {full:?}; the kill window would be pure luck"
    );

    let mut killed_before_fold = 0;
    let mut killed_after_fold = 0;
    // The visibility chunk is the last of many, so a delay sampled only inside the
    // publish would land before the fold every time and never exercise the other side of
    // the invariant. The tail of this range deliberately runs past the publish.
    for attempt in 0..14 {
        let path = fixture_db(dir.path(), &format!("killed_{attempt}.db"));
        // Seed a prior fold so "the state before" is a real session history, not an
        // empty table: a reader must see that exact history, not merely "nothing".
        {
            let mut store = HostStore::open(&path).unwrap();
            let mut prior = publish_of("ses_kill", 1, 1);
            prior.compartments[0].title = "prior fold".to_string();
            store.publish_fold(&prior).unwrap();
        }

        let delay = full.mul_f64(f64::from(attempt) / 10.0);
        let mut child = spawn_child_publish(&exe, &path, Some("ses_kill_second"));
        std::thread::sleep(delay);
        let _ = child.kill();
        let _ = child.wait();

        let conn = Connection::open(&path).unwrap();
        conn.busy_timeout(Duration::from_millis(5_000)).unwrap();
        let compartments = count(
            &conn,
            "SELECT COUNT(*) FROM compartments WHERE session_id = 'ses_kill_second'",
        );
        let facts = count(
            &conn,
            "SELECT COUNT(*) FROM session_facts WHERE session_id = 'ses_kill_second'",
        );
        let events = count(
            &conn,
            "SELECT COUNT(*) FROM compartment_events WHERE session_id = 'ses_kill_second'",
        );
        let prior_compartments = count(
            &conn,
            "SELECT COUNT(*) FROM compartments WHERE session_id = 'ses_kill'",
        );
        let armed = count(
            &conn,
            "SELECT COALESCE((SELECT enabled FROM context_privilege_state WHERE id = 1), 0)",
        );

        assert_eq!(
            armed, 0,
            "attempt {attempt}: a killed process left the privilege row armed"
        );
        assert_eq!(
            prior_compartments, 1,
            "attempt {attempt}: the fold that was already there was damaged"
        );
        if compartments == 0 {
            assert_eq!(
                facts, 0,
                "attempt {attempt}: facts without their compartments"
            );
            assert_eq!(
                events, 0,
                "attempt {attempt}: events without their compartments"
            );
            killed_before_fold += 1;
        } else {
            assert_eq!(
                compartments, 2,
                "attempt {attempt}: a partial set of compartments is visible"
            );
            assert_eq!(
                facts, 1,
                "attempt {attempt}: a compartment without its facts"
            );
            assert_eq!(
                events, 1,
                "attempt {attempt}: a compartment without its events"
            );
            killed_after_fold += 1;
        }
    }

    println!(
        "kill gate: {killed_before_fold} kills landed before the fold, {killed_after_fold} after it"
    );
    assert!(
        killed_before_fold > 0,
        "every kill landed after the fold committed; the pre-fold window was never exercised"
    );
    assert!(
        killed_after_fold > 0,
        "no kill landed after the fold committed; the post-fold state was never checked"
    );
}

/// Re-running a publish duplicates its standalone rows and then dies on a constraint.
///
/// **This records a defect, not a guarantee.** The writers assume the chunks before the
/// visibility chunk are safe for a reader to see mid-fold, because each of those rows
/// stands on its own. That is true for a reader. It is not true for a retry:
///
/// * `notes`, `user_memory_candidates` and `user_memories` are plain appends with no
///   natural key and no upsert, so a second run leaves two of each row;
/// * `memories` deduplicates on content, but the retry bumps `seen_count` on the rows the
///   first attempt wrote, so a crashed publish makes its own memories look twice-seen;
/// * `primer_candidates` is the one writer that upserts cleanly;
/// * `compartments` carries `UNIQUE(session_id, sequence)`, so a retry that gets as far as
///   the visibility chunk aborts with a raw SQLite constraint error — after the staged
///   chunks have already committed their duplicates.
///
/// So a retry is not a resume and not a discard: it is a partial duplicate followed by an
/// untyped failure. The fix has to give every staged writer the idempotency
/// `primer_candidates` already has — a natural key and an upsert, or a publish identity a
/// retry can recognise — before a publish may be retried at all.
#[test]
fn a_retried_publish_duplicates_its_standalone_rows_then_dies_on_a_constraint() {
    let dir = tempfile::tempdir().unwrap();
    let path = fixture_db(dir.path(), "context.db");

    let publish = publish_of("ses_retry", 3, 2);
    {
        let mut store = HostStore::open(&path).unwrap();
        store.set_chunk_budget(64);
        store.publish_fold(&publish).unwrap();
    }
    let retry = {
        // A fresh handle is what a restarted module would have.
        let mut store = HostStore::open(&path).unwrap();
        store.set_chunk_budget(64);
        store.publish_fold(&publish)
    };

    let error = retry.expect_err("a retry became idempotent: invert this test and close it");
    assert_eq!(
        error.code(),
        "single_store_sqlite_error",
        "the retry failed, but no longer on the raw constraint this pins: {error}"
    );
    assert!(
        error.to_string().contains("UNIQUE"),
        "expected the compartments uniqueness constraint, got {error}"
    );

    let conn = Connection::open(&path).unwrap();
    assert_eq!(
        count(
            &conn,
            "SELECT COUNT(*) FROM notes WHERE session_id = 'ses_retry'"
        ),
        2,
        "notes gained idempotency: invert this test and close the finding"
    );
    assert_eq!(
        count(
            &conn,
            "SELECT COUNT(*) FROM user_memory_candidates WHERE session_id = 'ses_retry'"
        ),
        2,
        "user observations gained idempotency: invert this test and close the finding"
    );
    // The fold itself is untouched, which is the one thing that did hold.
    assert_eq!(
        count(
            &conn,
            "SELECT COUNT(*) FROM compartments WHERE session_id = 'ses_retry'"
        ),
        2,
        "the aborted retry duplicated compartments"
    );
    assert_eq!(
        count(
            &conn,
            "SELECT COUNT(*) FROM memories WHERE project_path = 'git:gate'"
        ),
        3,
        "memories must deduplicate on content across a retry"
    );
    assert_eq!(
        count(
            &conn,
            "SELECT COUNT(*) FROM primer_candidates WHERE session_id = 'ses_retry'"
        ),
        1,
        "primer candidates must upsert on their source range across a retry"
    );
    assert_eq!(
        count(
            &conn,
            "SELECT MIN(seen_count) FROM memories WHERE project_path = 'git:gate'"
        ),
        2,
        "seen_count no longer double-counts a retry: invert this test and close the finding"
    );
}

// ── Claim 7: the chunk budget ───────────────────────────────────────────────

/// The visibility chunk is not held to the row budget at all.
///
/// **This records a defect.** `plan_chunks` bounds the staged chunks and then appends one
/// unbounded visibility chunk carrying every compartment, every session fact and every
/// event. `publish_fold` only raises `ChunkBudgetExceeded` for staged chunks, so the
/// largest single transaction the module can take is unbounded by construction — the
/// opposite of the requirement that a fold publish land as bounded chunks under a write
/// budget, so no seat waits long behind it.
///
/// The fix must either bound the visibility chunk too — which needs a publish sequence
/// number readers can gate on, because splitting the chunk is exactly what the current
/// ordering forbids — or state a hard ceiling on compartments-per-publish and enforce it.
#[test]
fn the_visibility_chunk_ignores_the_row_budget() {
    let dir = tempfile::tempdir().unwrap();
    let path = fixture_db(dir.path(), "context.db");
    let mut store = HostStore::open(&path).unwrap();
    store.set_chunk_budget(8);

    let mut publish = publish_of("ses_wide", 0, 400);
    publish.notes.clear();
    publish.primer_candidates.clear();
    publish.user_observations.clear();
    publish.facts = (0..400)
        .map(|index| HostSessionFact {
            category: "Decisions".to_string(),
            content: format!("fact {index}"),
        })
        .collect();
    publish.events = (0..400)
        .map(|index| HostCompartmentEvent {
            kind: "causal_incident".to_string(),
            at_compartment: Some(index as i64 + 1),
            fields_json: "{}".to_string(),
        })
        .collect();

    let outcome = store
        .publish_fold(&publish)
        .expect("the publish is accepted");
    let last_rows = *outcome.chunk_rows.last().unwrap();
    let last_us = *outcome.chunk_durations_us.last().unwrap();
    assert!(
        last_rows > 8,
        "the visibility chunk is bounded now: invert this test and close the finding"
    );
    assert_eq!(last_rows, 1_201, "1200 rows plus the facts delete");
    println!(
        "visibility-chunk gate: budget=8 rows visibility_chunk_rows={last_rows} duration_us={last_us} ceiling_us={PUBLISH_CHUNK_BUDGET_US}"
    );
}

/// Reproduce the slice's chunk-cost sweep on a store that already holds rows, which is
/// the only shape a real `context.db` ever has.
///
/// The shipped measurement ran against a database created seconds earlier from the schema
/// snapshot: no memories, an empty full-text index, a cold WAL. This seeds the store
/// first so the FTS5 segment merges the budget is supposed to survive actually happen.
///
///   cargo test -p mc-module --test single_store_gate -- --ignored --nocapture
#[test]
#[ignore = "measurement instrument, not an assertion"]
fn measure_chunk_cost_on_a_seeded_store() {
    for seed_rows in [0_usize, 640, 6_400] {
        let dir = tempfile::tempdir().unwrap();
        let path = fixture_db(dir.path(), "context.db");
        if seed_rows > 0 {
            let mut store = HostStore::open(&path).unwrap();
            store.set_chunk_budget(256);
            let mut seed = publish_of("ses_seed", seed_rows, 0);
            seed.notes.clear();
            seed.primer_candidates.clear();
            seed.user_observations.clear();
            seed.facts.clear();
            seed.events.clear();
            store.publish_fold(&seed).unwrap();
        }
        let file_bytes = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

        for rows in [16_usize, 32, 64, 128, 256, 512, 1024] {
            let mut store = HostStore::open(&path).unwrap();
            store.set_chunk_budget(rows);
            let mut publish = publish_of(&format!("ses_m_{seed_rows}_{rows}"), rows, 0);
            publish.notes.clear();
            publish.primer_candidates.clear();
            publish.user_observations.clear();
            publish.facts.clear();
            publish.events.clear();
            let outcome = store.publish_fold(&publish).unwrap();
            // The last chunk is the (empty) visibility chunk; the staged chunks are what
            // the row budget sizes.
            let staged_worst = outcome.chunk_durations_us[..outcome.chunk_durations_us.len() - 1]
                .iter()
                .copied()
                .max()
                .unwrap_or(0);
            let percent_of_busy_timeout = staged_worst as f64 / 5_000_000.0 * 100.0;
            println!(
                "seed_rows={seed_rows} db_bytes={file_bytes} rows={rows} worst_staged_chunk_us={staged_worst} pct_of_busy_timeout={percent_of_busy_timeout:.3}"
            );
        }
    }
    println!("shipped budget = {DEFAULT_PUBLISH_CHUNK_ROWS} rows, ceiling = {PUBLISH_CHUNK_BUDGET_US} us");
}

// ── Child process used by the kill test ─────────────────────────────────────

const CHILD_DB_ENV: &str = "SINGLE_STORE_GATE_CHILD_DB";
const CHILD_SESSION_ENV: &str = "SINGLE_STORE_GATE_CHILD_SESSION";

fn spawn_child_publish(exe: &Path, db: &Path, session: Option<&str>) -> std::process::Child {
    let mut command = std::process::Command::new(exe);
    command
        .arg("--exact")
        .arg("child_publish_for_the_kill_test")
        .arg("--ignored")
        .arg("--nocapture")
        .env(CHILD_DB_ENV, db)
        .env(CHILD_SESSION_ENV, session.unwrap_or("ses_kill_second"))
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    command.spawn().expect("spawn the child publisher")
}

fn run_child_publish(exe: &Path, db: &Path, session: Option<&str>) {
    let status = spawn_child_publish(exe, db, session)
        .wait()
        .expect("wait for the child publisher");
    assert!(status.success(), "the baseline child publish failed");
}

/// The publish the kill test kills. Ignored so it never runs as part of the suite: it is
/// a program the test above executes, not a claim of its own.
#[test]
#[ignore = "re-executed as a child process by the kill test"]
fn child_publish_for_the_kill_test() {
    let db = PathBuf::from(std::env::var(CHILD_DB_ENV).expect("child database path"));
    let session = std::env::var(CHILD_SESSION_ENV).expect("child session id");
    let mut store = HostStore::open(&db).expect("child opens the fixture");
    // A small budget so the publish is many transactions long and the kill has somewhere
    // to land between them.
    store.set_chunk_budget(4);
    let publish = publish_of(&session, 600, 2);
    store.publish_fold(&publish).expect("child publish");
}
