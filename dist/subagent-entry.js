import {
  setHarness,
  log
} from "./index-83wwtw1q.js";
import {
  setStoragePrivatePermissionEnforcement,
  resolveProjectIdentityForSession,
  openDatabase,
  loadPiConfig,
  ensureProjectRegisteredFromPiDirectory,
  resolvePiHarnessKind,
  registerMagicContextTools
} from "./index-cxazghqx.js";
import"./index-vcjgpb6f.js";
import {
  appendUsagePricingSnapshot
} from "./index-v6cfsdk5.js";
import"./index-y33j7m6y.js";

// src/subagent-entry.ts
var SUBAGENT_DREAMER_ACTIONS_FLAG = "magic-context-dreamer-actions";
var openedDb;
function magicContextSubagentExtension(pi) {
  setHarness(resolvePiHarnessKind());
  pi.on("message_end", (event, ctx) => {
    if (resolvePiHarnessKind() !== "omp")
      return;
    try {
      appendUsagePricingSnapshot(event.message, ctx.modelRegistry);
    } catch (error) {
      log(`[pi-subagent] usage snapshot failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  pi.registerFlag(SUBAGENT_DREAMER_ACTIONS_FLAG, {
    description: "Register ctx_memory with dreamer actions for Magic Context subagents.",
    type: "boolean",
    default: false
  });
  pi.on("session_start", async () => {
    try {
      const directory = process.cwd();
      const { config: cfg, registrationPromptSurface } = loadPiConfig({
        cwd: directory
      });
      setStoragePrivatePermissionEnforcement(cfg.storage.enforce_private_permissions);
      const db = openDatabase();
      if (!db) {
        throw new Error("storage open failed; refusing to start without Magic Context tools");
      }
      openedDb = db;
      await ensureProjectRegisteredFromPiDirectory(directory, db);
      const dreamerActionsEnabled = pi.getFlag(SUBAGENT_DREAMER_ACTIONS_FLAG) === true;
      registerMagicContextTools(pi, {
        db,
        ensureProjectRegistered: ensureProjectRegisteredFromPiDirectory,
        resolveProjectIdentity: (ctx) => resolveProjectIdentityForSession(ctx.cwd, cfg.allow_home_project),
        memoryToolEnabled: dreamerActionsEnabled,
        allowDreamerActions: dreamerActionsEnabled,
        sessionScopedToolsDisabled: true,
        todowriteEnabled: cfg.todowrite.enabled !== false,
        todowriteCommandEnabled: false,
        promptSurface: registrationPromptSurface
      });
      log(`[pi-subagent] registered tools: ctx_search${dreamerActionsEnabled ? ", ctx_memory" : ""}${cfg.todowrite.enabled !== false ? ", todowrite" : ""}` + ` (ctx_note/ctx_expand omitted: --no-session child;` + ` memory=${cfg.memory.enabled}, embedding=${cfg.embedding.provider !== "off"},` + ` git_commits=${cfg.memory.git_commit_indexing.enabled}, dreamer_actions=${dreamerActionsEnabled})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log(`[pi-subagent] startup failed: ${message}`);
      process.exitCode = 1;
      throw err;
    }
  });
  pi.on("session_shutdown", () => {
    if (openedDb) {
      try {
        openedDb.close();
      } catch {}
      openedDb = undefined;
    }
  });
}
export {
  magicContextSubagentExtension as default
};
