import {
  getHarness,
  log
} from "./index-83wwtw1q.js";

// ../plugin/src/features/magic-context/reclaim-protection.ts
var CTX_REDUCE_KEEP = 3;
function newestCtxReduceTagNumbers(tags) {
  return new Set(tags.filter((tag) => tag.toolName === "ctx_reduce").sort((left, right) => right.tagNumber - left.tagNumber).slice(0, CTX_REDUCE_KEEP).map((tag) => tag.tagNumber));
}

// ../plugin/src/hooks/magic-context/read-session-formatting.ts
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// ../plugin/src/shared/commit-detection.ts
var HASH_HEX = "[0-9a-f]{7,12}";
var COMMIT_HASH_TEST_PATTERN = new RegExp(`\\b${HASH_HEX}\\b`, "i");
var COMMIT_VERB_PATTERN = /\b(?:commit(?:ted|ting|s)?|cherry-?pick(?:ed|ing|s)?|merge[ds]?|merging|rebas(?:e|ed|es|ing))\b/i;
function textMentionsRecentCommit(text) {
  return COMMIT_HASH_TEST_PATTERN.test(text) && COMMIT_VERB_PATTERN.test(text);
}
function createCommitHashExtractPattern() {
  return new RegExp(`\`?\\b(${HASH_HEX})\\b\`?`, "gi");
}

// ../plugin/src/shared/internal-initiator-marker.ts
var OMO_INTERNAL_INITIATOR_MARKER = "<!-- OMO_INTERNAL_INITIATOR -->";

// ../plugin/src/shared/system-directive.ts
var SYSTEM_DIRECTIVE_PREFIX = "[SYSTEM DIRECTIVE: MAGIC-CONTEXT";
function isSystemDirective(text) {
  return text.trimStart().startsWith(SYSTEM_DIRECTIVE_PREFIX);
}
function removeSystemReminders(text) {
  return text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, "").trim();
}

// ../plugin/src/hooks/magic-context/read-session-formatting.ts
var MAX_COMMITS_PER_BLOCK = 5;
function hasMeaningfulUserText2(parts) {
  for (const part of parts) {
    if (part === null || typeof part !== "object")
      continue;
    const candidate = part;
    if (candidate.type !== "text" || typeof candidate.text !== "string")
      continue;
    if (candidate.ignored === true)
      continue;
    const cleaned = removeSystemReminders(candidate.text).replace(OMO_INTERNAL_INITIATOR_MARKER, "").trim();
    if (!cleaned)
      continue;
    if (isSystemDirective(cleaned))
      continue;
    return true;
  }
  return false;
}
function extractTexts2(parts) {
  const texts = [];
  for (const part of parts) {
    if (part === null || typeof part !== "object")
      continue;
    const p = part;
    if (p.type === "text" && typeof p.text === "string" && p.text.trim().length > 0) {
      texts.push(p.text.trim());
    }
  }
  return texts;
}
function extractToolResultBodyTokens(parts) {
  let tokens = 0;
  for (const part of parts) {
    if (part === null || typeof part !== "object")
      continue;
    const p = part;
    if (p.type !== "tool")
      continue;
    const state = p.state;
    if (!state || typeof state !== "object")
      continue;
    const body = state.output ?? state.error;
    if (body === undefined)
      continue;
    const text = typeof body === "string" ? body : JSON.stringify(body);
    tokens += Math.ceil(text.length / 4);
  }
  return tokens;
}
function extractToolCallSummaries(parts) {
  const summaries = [];
  for (const part of parts) {
    if (part === null || typeof part !== "object")
      continue;
    const p = part;
    if (p.type !== "tool" || typeof p.tool !== "string")
      continue;
    const state = p.state;
    if (!state || typeof state !== "object")
      continue;
    const input = state.input;
    const metadata = state.metadata;
    const description = input && typeof input.description === "string" && input.description || metadata && typeof metadata.description === "string" && metadata.description;
    if (description) {
      summaries.push(`TC: ${description}`);
      continue;
    }
    const toolName = p.tool;
    const keyArg = extractKeyArg(toolName, input);
    summaries.push(keyArg ? `TC: ${toolName}(${keyArg})` : `TC: ${toolName}`);
  }
  return summaries;
}
function extractKeyArg(_toolName, input) {
  if (!input)
    return null;
  if (typeof input.filePath === "string")
    return truncateArg(input.filePath);
  if (typeof input.path === "string")
    return truncateArg(input.path);
  if (typeof input.pattern === "string")
    return truncateArg(input.pattern);
  if (typeof input.query === "string")
    return truncateArg(input.query);
  if (typeof input.symbol === "string")
    return input.symbol;
  if (typeof input.module === "string")
    return input.module;
  if (typeof input.action === "string")
    return input.action;
  return null;
}
function truncateArg(value, maxLen = 60) {
  if (value.length <= maxLen)
    return value;
  return `${value.slice(0, maxLen)}…`;
}
var TOKENIZER_PACKAGE_DIRS = [
  ["@cortexkit", "opencode-magic-context"],
  ["@cortexkit", "pi-magic-context"]
];
var tokenizer;
var tokenizerLoadAttempted = false;
var tokenizerLoadPromise;
var tokenizerWarningSent = false;
var tokenizerEncodingPath;
var tokenizerSerializedTableBytes;
function tokenizerPackageRoots() {
  const cwd = process.cwd();
  const openCodeCache = join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "opencode");
  const roots = [cwd, openCodeCache];
  const candidates = [];
  for (const root of roots) {
    for (const packageDir of TOKENIZER_PACKAGE_DIRS) {
      candidates.push(join(root, "node_modules", ...packageDir, "node_modules", "ai-tokenizer"));
    }
    candidates.push(join(root, "node_modules", "ai-tokenizer"));
  }
  let ancestor = process.argv[1] ? dirname(resolve(process.argv[1])) : cwd;
  while (true) {
    candidates.push(join(ancestor, "node_modules", "ai-tokenizer"));
    const parent = dirname(ancestor);
    if (parent === ancestor)
      break;
    ancestor = parent;
  }
  return [...new Set(candidates)];
}
function packageImportTarget(value) {
  if (typeof value === "string")
    return value;
  if (!value || typeof value !== "object")
    return;
  const conditions = value;
  return packageImportTarget(conditions.import) ?? packageImportTarget(conditions.default);
}
function findTokenizerImportPaths() {
  for (const packageRoot of tokenizerPackageRoots()) {
    const packageJsonPath = join(packageRoot, "package.json");
    if (!existsSync(packageJsonPath))
      continue;
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
      const tokenizerTarget = packageImportTarget(packageJson.exports?.["."]) ?? (typeof packageJson.module === "string" ? packageJson.module : undefined) ?? (typeof packageJson.main === "string" ? packageJson.main : undefined);
      const encodingTarget = packageImportTarget(packageJson.exports?.["./encoding/claude"]);
      if (!tokenizerTarget || !encodingTarget)
        continue;
      return {
        tokenizerPath: realpathSync(join(packageRoot, tokenizerTarget)),
        encodingPath: realpathSync(join(packageRoot, encodingTarget))
      };
    } catch {}
  }
  return;
}
function constructTokenizer(tokenizerModule, claudeEncoding) {
  const typedModule = tokenizerModule;
  const Tokenizer = typedModule.default ?? typedModule.Tokenizer;
  if (!Tokenizer) {
    throw new Error("ai-tokenizer does not expose a Tokenizer constructor");
  }
  return new Tokenizer(claudeEncoding);
}
function loadTokenizer() {
  const requireFromThisModule = createRequire(import.meta.url);
  const encodingSpecifier = "ai-tokenizer/encoding/" + "claude";
  tokenizerEncodingPath = requireFromThisModule.resolve(encodingSpecifier);
  tokenizerSerializedTableBytes = undefined;
  return constructTokenizer(requireFromThisModule("ai-" + "tokenizer"), requireFromThisModule(encodingSpecifier));
}
async function loadTokenizerFromInstalledPackage() {
  const installedPaths = findTokenizerImportPaths();
  if (!installedPaths) {
    throw new Error("ai-tokenizer was not found under the project, runtime, or OpenCode cache node_modules roots");
  }
  const [tokenizerModule, claudeEncoding] = await Promise.all([
    import(pathToFileURL(installedPaths.tokenizerPath).href),
    import(pathToFileURL(installedPaths.encodingPath).href)
  ]);
  tokenizerEncodingPath = installedPaths.encodingPath;
  tokenizerSerializedTableBytes = undefined;
  return constructTokenizer(tokenizerModule, claudeEncoding);
}
function warnTokenizerFallback(error) {
  if (tokenizerWarningSent)
    return;
  tokenizerWarningSent = true;
  const reason = error instanceof Error ? error.message : String(error);
  console.warn("[magic-context] ai-tokenizer is unavailable; using approximate character-based token counts for this process. Token budgets, persisted per-message counts, and protected-tail/compartment boundaries may be less accurate until restart:", reason);
}
async function preloadTokenizer() {
  if (tokenizer)
    return true;
  if (tokenizerLoadAttempted)
    return false;
  if (tokenizerLoadPromise)
    return tokenizerLoadPromise;
  tokenizerLoadPromise = (async () => {
    try {
      try {
        tokenizer = loadTokenizer();
      } catch {
        tokenizer = await loadTokenizerFromInstalledPackage();
      }
      tokenizerLoadAttempted = true;
      return true;
    } catch (error) {
      tokenizerLoadAttempted = true;
      warnTokenizerFallback(error);
      return false;
    } finally {
      tokenizerLoadPromise = undefined;
    }
  })();
  return tokenizerLoadPromise;
}
function getTokenizer() {
  if (tokenizer || tokenizerLoadAttempted)
    return tokenizer;
  tokenizerLoadAttempted = true;
  try {
    tokenizer = loadTokenizer();
  } catch (error) {
    warnTokenizerFallback(error);
  }
  return tokenizer;
}
function estimateTokensHeuristically(text) {
  return Math.ceil(text.length / 3.5);
}
function estimateTokens(text) {
  if (!text)
    return 0;
  const activeTokenizer = getTokenizer();
  if (!activeTokenizer)
    return estimateTokensHeuristically(text);
  try {
    return activeTokenizer.encode(text, "all").length;
  } catch (error) {
    tokenizer = undefined;
    tokenizerLoadAttempted = true;
    warnTokenizerFallback(error);
    return estimateTokensHeuristically(text);
  }
}
function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}
function compactRole(role) {
  if (role === "assistant")
    return "A";
  if (role === "user")
    return "U";
  return role.slice(0, 1).toUpperCase() || "M";
}
function formatBlock(block) {
  const range = block.startOrdinal === block.endOrdinal ? `[${block.startOrdinal}]` : `[${block.startOrdinal}-${block.endOrdinal}]`;
  const commitSuffix = block.commitHashes.length > 0 ? ` commits: ${block.commitHashes.join(", ")}` : "";
  return `${range} ${block.role}:${commitSuffix} ${block.parts.join(" / ")}`;
}
function extractCommitHashes(text) {
  const hashes = [];
  const seen = new Set;
  for (const match of text.matchAll(createCommitHashExtractPattern())) {
    const hash = match[1]?.toLowerCase();
    if (!hash || seen.has(hash))
      continue;
    seen.add(hash);
    hashes.push(hash);
    if (hashes.length >= MAX_COMMITS_PER_BLOCK)
      break;
  }
  return hashes;
}
function compactTextForSummary(text, role) {
  const commitHashes = role === "assistant" ? extractCommitHashes(text) : [];
  if (commitHashes.length === 0 || !COMMIT_VERB_PATTERN.test(text)) {
    return { text, commitHashes };
  }
  const withoutHashes = text.replace(createCommitHashExtractPattern(), "").replace(/\(\s*\)/g, "").replace(/\s+,/g, ",").replace(/,\s*,+/g, ", ").replace(/\s{2,}/g, " ").replace(/\s+([,.;:])/g, "$1").trim();
  return {
    text: withoutHashes.length > 0 ? withoutHashes : text,
    commitHashes
  };
}
function mergeCommitHashes(existing, next) {
  if (next.length === 0)
    return existing;
  const merged = [...existing];
  for (const hash of next) {
    if (merged.includes(hash))
      continue;
    merged.push(hash);
    if (merged.length >= MAX_COMMITS_PER_BLOCK)
      break;
  }
  return merged;
}

// ../plugin/src/hooks/magic-context/tag-content-primitives.ts
var encoder = new TextEncoder;
var TAG_PREFIX_REGEX = /^(?:§\d+§\s*)+/;
var MALFORMED_TAG_PREFIX_REGEX = /^(?:§\d+">§(?:\d+§)?\s*)+/;
var DANGLING_TAG_GLOBAL_REGEX = /\u00a7\d+(?!\.\d)[^\s\u00a7\w.]?/g;
var DANGLING_TAG_PREFIX_REGEX = /^(?:\u00a7\d+(?!\.\d)[^\s\u00a7\w.]?\s*)+/;
var COMPLETE_TAG_PAIR_GLOBAL_REGEX = /\u00a7\d+\u00a7/g;
var MALFORMED_TAG_GLOBAL_REGEX = /\u00a7\d+">(?:\u00a7(?:\d+\u00a7)?)?/g;
var STRAY_SECTION_CHAR_REGEX = /\u00a7/g;
function stripWellFormedLeadingTagPrefix(value) {
  return value.replace(/^(\u00a7\d+\u00a7\s*)+/, "");
}
function stripCompleteTagPairsGlobally(value) {
  return value.replace(COMPLETE_TAG_PAIR_GLOBAL_REGEX, "");
}
function stripMalformedTagNotationGlobally(value) {
  return value.replace(MALFORMED_TAG_GLOBAL_REGEX, "");
}
function stripDanglingTagNotationGlobally(value) {
  return value.replace(DANGLING_TAG_GLOBAL_REGEX, "");
}
function stripTagSectionCharacters(value) {
  return value.replace(STRAY_SECTION_CHAR_REGEX, "");
}
function stripPersistedAssistantText(value) {
  let text = stripWellFormedLeadingTagPrefix(value);
  text = stripCompleteTagPairsGlobally(text);
  text = stripMalformedTagNotationGlobally(text);
  text = stripDanglingTagNotationGlobally(text);
  text = stripTagSectionCharacters(text);
  return text.trim();
}
function byteSize(value) {
  return encoder.encode(value).length;
}
function stripTagPrefix(value) {
  let stripped = value;
  for (let pass = 0;pass < 8; pass++) {
    const prev = stripped;
    stripped = stripped.replace(MALFORMED_TAG_PREFIX_REGEX, "");
    stripped = stripped.replace(TAG_PREFIX_REGEX, "");
    stripped = stripped.replace(DANGLING_TAG_PREFIX_REGEX, "");
    if (stripped === prev)
      break;
  }
  return stripped;
}
function peelLeadingMcTagNotation(value) {
  const body = stripTagPrefix(value);
  if (body === value)
    return { tagPrefix: "", body };
  return { tagPrefix: value.slice(0, value.length - body.length), body };
}
function prependTag(tagId, value) {
  const stripped = stripTagPrefix(value);
  return `§${tagId}§ ${stripped}`;
}

// ../plugin/src/shared/record-type-guard.ts
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ../plugin/src/shared/stable-json.ts
function stableStringify(value, seen = new WeakSet) {
  if (value === undefined)
    return "undefined";
  if (value === null || typeof value !== "object")
    return JSON.stringify(value) ?? String(value);
  if (seen.has(value))
    return '"[Circular]"';
  seen.add(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item, seen)).join(",")}]`;
  }
  const entries = Object.entries(value).sort(([a], [b]) => {
    if (a < b)
      return -1;
    if (a > b)
      return 1;
    return 0;
  });
  return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child, seen)}`).join(",")}}`;
}

// ../plugin/src/hooks/magic-context/image-token-estimate.ts
var IMAGE_TOKEN_DIVISOR = 750;
var IMAGE_FALLBACK_TOKENS = 1200;
var IMAGE_TOKEN_CAP = 4500;
function estimateImageTokensFromDataUrl(url) {
  const comma = url.indexOf(",");
  if (comma < 0)
    return IMAGE_FALLBACK_TOKENS;
  const header = url.slice(0, comma);
  const payload = url.slice(comma + 1);
  const sliceLen = Math.min(512, payload.length);
  const preview = payload.slice(0, sliceLen);
  let bytes;
  try {
    bytes = base64Decode(preview);
  } catch {
    return IMAGE_FALLBACK_TOKENS;
  }
  if (header.includes("image/png")) {
    const dims = parsePngDimensions(bytes);
    if (dims)
      return clampImageTokens(Math.ceil(dims.w * dims.h / IMAGE_TOKEN_DIVISOR));
  } else if (header.includes("image/jpeg") || header.includes("image/jpg")) {
    const dims = parseJpegDimensions(bytes);
    if (dims)
      return clampImageTokens(Math.ceil(dims.w * dims.h / IMAGE_TOKEN_DIVISOR));
  } else if (header.includes("image/webp")) {
    const dims = parseWebpDimensions(bytes);
    if (dims)
      return clampImageTokens(Math.ceil(dims.w * dims.h / IMAGE_TOKEN_DIVISOR));
  } else if (header.includes("image/gif")) {
    const dims = parseGifDimensions(bytes);
    if (dims)
      return clampImageTokens(Math.ceil(dims.w * dims.h / IMAGE_TOKEN_DIVISOR));
  }
  return IMAGE_FALLBACK_TOKENS;
}
function clampImageTokens(n) {
  if (n < 1)
    return 1;
  if (n > IMAGE_TOKEN_CAP)
    return IMAGE_TOKEN_CAP;
  return n;
}
function base64Decode(b64) {
  const pad = b64.length % 4;
  const padded = pad === 0 ? b64 : b64 + "=".repeat(4 - pad);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0;i < binary.length; i++)
    out[i] = binary.charCodeAt(i);
  return out;
}
function parsePngDimensions(b) {
  if (b.length < 24)
    return null;
  if (b[0] !== 137 || b[1] !== 80 || b[2] !== 78 || b[3] !== 71 || b[4] !== 13 || b[5] !== 10 || b[6] !== 26 || b[7] !== 10)
    return null;
  const w = readUint32BE(b, 16);
  const h = readUint32BE(b, 20);
  if (!w || !h)
    return null;
  return { w, h };
}
function parseJpegDimensions(b) {
  if (b.length < 4 || b[0] !== 255 || b[1] !== 216)
    return null;
  let i = 2;
  while (i < b.length - 8) {
    if (b[i] !== 255) {
      i++;
      continue;
    }
    const marker = b[i + 1];
    if (marker === undefined)
      break;
    if (isSofMarker(marker)) {
      const h = b[i + 5] << 8 | b[i + 6];
      const w = b[i + 7] << 8 | b[i + 8];
      if (w && h)
        return { w, h };
      return null;
    }
    if (marker === 216 || marker === 217 || marker === 1) {
      i += 2;
      continue;
    }
    const segLen = b[i + 2] << 8 | b[i + 3];
    if (segLen < 2)
      return null;
    i += 2 + segLen;
  }
  return null;
}
function isSofMarker(m) {
  if (m >= 192 && m <= 195)
    return true;
  if (m >= 197 && m <= 199)
    return true;
  if (m >= 201 && m <= 203)
    return true;
  if (m >= 205 && m <= 207)
    return true;
  return false;
}
function parseWebpDimensions(b) {
  if (b.length < 30)
    return null;
  if (b[0] !== 82 || b[1] !== 73 || b[2] !== 70 || b[3] !== 70)
    return null;
  if (b[8] !== 87 || b[9] !== 69 || b[10] !== 66 || b[11] !== 80)
    return null;
  const variant = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (variant === "VP8 ") {
    const w = (b[26] | b[27] << 8) & 16383;
    const h = (b[28] | b[29] << 8) & 16383;
    if (w && h)
      return { w, h };
  } else if (variant === "VP8L") {
    const b0 = b[21];
    const b1 = b[22];
    const b2 = b[23];
    const b3 = b[24];
    const w = 1 + ((b0 | b1 << 8) & 16383);
    const h = 1 + ((b1 >> 6 | b2 << 2 | b3 << 10) & 16383);
    if (w && h)
      return { w, h };
  } else if (variant === "VP8X") {
    const w = 1 + (b[24] | b[25] << 8 | b[26] << 16);
    const h = 1 + (b[27] | b[28] << 8 | b[29] << 16);
    if (w && h)
      return { w, h };
  }
  return null;
}
function parseGifDimensions(b) {
  if (b.length < 10)
    return null;
  if (b[0] !== 71 || b[1] !== 73 || b[2] !== 70)
    return null;
  const w = b[6] | b[7] << 8;
  const h = b[8] | b[9] << 8;
  if (!w || !h)
    return null;
  return { w, h };
}
function readUint32BE(b, offset) {
  return (b[offset] << 24 | b[offset + 1] << 16 | b[offset + 2] << 8 | b[offset + 3]) >>> 0;
}

// ../plugin/src/hooks/magic-context/todo-view.ts
import { createHash } from "node:crypto";
var TODO_STATUS_PENDING = "pending";
var TODO_STATUS_IN_PROGRESS = "in_progress";
var TODO_STATUS_COMPLETED = "completed";
var TODO_STATUS_CANCELLED = "cancelled";
var TODO_PRIORITY_HIGH = "high";
var TODO_PRIORITY_MEDIUM = "medium";
var TODO_PRIORITY_LOW = "low";
var TODO_STATUSES = [
  TODO_STATUS_PENDING,
  TODO_STATUS_IN_PROGRESS,
  TODO_STATUS_COMPLETED,
  TODO_STATUS_CANCELLED
];
var TODO_PRIORITIES = [
  TODO_PRIORITY_HIGH,
  TODO_PRIORITY_MEDIUM,
  TODO_PRIORITY_LOW
];
var TODO_STATUS_SET = new Set(TODO_STATUSES);
var TODO_PRIORITY_SET = new Set(TODO_PRIORITIES);
var TERMINAL_STATUSES = new Set([
  TODO_STATUS_COMPLETED,
  TODO_STATUS_CANCELLED
]);
var TITLE_DONE_STATUSES = new Set([TODO_STATUS_COMPLETED]);
var SYNTHETIC_CALL_ID_PREFIX = "mc_synthetic_todo_";
function normalizeTodoStateJson(todos) {
  if (!Array.isArray(todos))
    return null;
  const normalized = [];
  for (const todo of todos) {
    if (!isTodoItem(todo))
      return null;
    normalized.push({
      content: todo.content,
      status: todo.status,
      priority: todo.priority ?? TODO_PRIORITY_MEDIUM
    });
  }
  return JSON.stringify(normalized);
}
function buildSyntheticTodoPart(stateJson) {
  const todos = parseTodoState(stateJson);
  if (todos === null || todos.length === 0)
    return null;
  if (todos.every((t) => TERMINAL_STATUSES.has(t.status)))
    return null;
  const callID = computeSyntheticCallId(stateJson);
  const activeCount = todos.filter((t) => !TITLE_DONE_STATUSES.has(t.status)).length;
  const output = JSON.stringify(todos, null, 2);
  const ts = 0;
  return {
    type: "tool",
    callID,
    tool: "todowrite",
    state: {
      status: "completed",
      input: { todos },
      output,
      title: `${activeCount} todos`,
      metadata: { todos, truncated: false },
      time: { start: ts, end: ts }
    },
    syntheticTodoMarker: true
  };
}
function computeSyntheticCallId(stateJson) {
  const hash = createHash("sha256").update(stateJson).digest("hex").slice(0, 16);
  return `${SYNTHETIC_CALL_ID_PREFIX}${hash}`;
}
function parseTodoState(stateJson) {
  if (stateJson.length === 0)
    return null;
  try {
    const parsed = JSON.parse(stateJson);
    if (!Array.isArray(parsed))
      return null;
    const result = [];
    for (const item of parsed) {
      if (!isTodoItem(item))
        return null;
      result.push({
        content: item.content,
        status: item.status,
        priority: item.priority ?? TODO_PRIORITY_MEDIUM
      });
    }
    return result;
  } catch {
    return null;
  }
}
function isTodoStatus(value) {
  return typeof value === "string" && TODO_STATUS_SET.has(value);
}
function isTodoPriority(value) {
  return typeof value === "string" && TODO_PRIORITY_SET.has(value);
}
function isTodoItem(value) {
  if (value === null || typeof value !== "object")
    return false;
  const todo = value;
  return typeof todo.content === "string" && isTodoStatus(todo.status) && (todo.priority === undefined || isTodoPriority(todo.priority));
}

// ../plugin/src/hooks/magic-context/tail-hygiene-walk.ts
var MAX_CONTENT_MEMO_BYTES = 64 * 1024 * 1024;
var contentMemo = new Map;
var CHANNEL1_REMINDER_OPEN = `

<system-reminder>
`;
var CHANNEL1_REMINDER_CLOSE = `
</system-reminder>`;
function stripChannel1ReminderSpans(output) {
  let stripped = output;
  while (stripped.endsWith(CHANNEL1_REMINDER_CLOSE)) {
    const opener = stripped.lastIndexOf(CHANNEL1_REMINDER_OPEN);
    if (opener < 0)
      break;
    stripped = stripped.slice(0, opener);
  }
  return stripped;
}
function messageIdFromPartKey(key) {
  const separator = key.indexOf("\x00");
  return separator > 0 ? key.slice(0, separator) : key;
}
function prefixMismatch(baseline, current, partIndex, field) {
  return {
    valid: false,
    boundaryAdvanceU: 0,
    queuedDropDeltaU: 0,
    mismatch: {
      partIndex,
      messageId: messageIdFromPartKey(baseline[partIndex]?.key ?? ""),
      field,
      frozenParts: baseline.length,
      measuredParts: current.length
    }
  };
}
function compareMeasuredTailPrefix(baseline, current) {
  if (current.length < baseline.length) {
    return prefixMismatch(baseline, current, current.length, "shorter");
  }
  let boundaryAdvanceU = 0;
  let queuedDropDeltaU = 0;
  for (let index = 0;index < baseline.length; index += 1) {
    const before = baseline[index];
    const after = current[index];
    const changedField = comparedField(before, after);
    if (changedField)
      return prefixMismatch(baseline, current, index, changedField);
    if (before.protected && !after.protected) {
      boundaryAdvanceU += after.uTokens;
    } else if (before.queuedForDrop !== after.queuedForDrop) {
      queuedDropDeltaU += after.uTokens - before.uTokens;
    }
  }
  return { valid: true, boundaryAdvanceU, queuedDropDeltaU };
}
function comparedField(before, after) {
  if (before.key !== after.key)
    return "key";
  if (before.contentHash !== after.contentHash)
    return "contentHash";
  if (before.kind !== after.kind)
    return "kind";
  if (before.tokens !== after.tokens)
    return "tokens";
  if (before.tagNumber !== after.tagNumber)
    return "tagNumber";
  if (before.tagStatus !== after.tagStatus)
    return "tagStatus";
  if (!before.protected && after.protected)
    return "protection-entered";
  if (before.protected && !after.protected) {
    return after.tagStatus === "active" ? null : "protection-exit-inactive";
  }
  if (before.queuedForDrop !== after.queuedForDrop) {
    return before.tagStatus === "active" && after.tagStatus === "active" ? null : "queued-drop-inactive";
  }
  return before.uTokens === after.uTokens ? null : "uTokens";
}
function formatTailHygienePrefixMismatch(mismatch, baselineGeneration) {
  return [
    "tail hygiene prefix invalidated:",
    `part_index=${mismatch.partIndex}`,
    `message=${mismatch.messageId || "unknown"}`,
    `field=${mismatch.field}`,
    `frozen_parts=${mismatch.frozenParts}`,
    `measured_parts=${mismatch.measuredParts}`,
    "action=re-measured",
    `generation=${baselineGeneration}`
  ].join(" ");
}
var baselineMeasurementMemo = new Map;
var MAX_BASELINE_MEMO_SIZE = 32 * 1024 * 1024;
function freezeTailHygieneMeasurement(measured) {
  const cut = Math.min(Math.max(0, measured.newestMessagePartStart), measured.parts.length);
  let baselineT = 0;
  let baselineU = 0;
  for (let index = 0;index < cut; index += 1) {
    baselineT += measured.parts[index].tokens;
    baselineU += measured.parts[index].uTokens;
  }
  let turnDeltaT = 0;
  let turnDeltaU = 0;
  for (let index = cut;index < measured.parts.length; index += 1) {
    const part = measured.parts[index];
    turnDeltaT += part.tokens;
    if (part.kind !== "toolOutput" || !part.protected)
      turnDeltaU += part.uTokens;
  }
  baselineT = Math.max(0, baselineT);
  return {
    baselineU: Math.min(Math.max(0, baselineU), baselineT),
    baselineT,
    turnDeltaU,
    turnDeltaT,
    baselineParts: cut === measured.parts.length ? measured.parts : measured.parts.slice(0, cut)
  };
}
function effectiveTailHygiene(baseline) {
  const t = Math.ceil(Math.max(0, baseline.baselineT + baseline.turnDeltaT));
  const u = Math.min(t, Math.ceil(Math.max(0, baseline.baselineU + baseline.turnDeltaU)));
  return { u, t };
}

// ../plugin/src/hooks/magic-context/ctx-reduce-nudge.ts
var CHANNEL1_SENTINEL = "<system-reminder>";
var TOKENS_PER_BYTE = 0.25;
var CHANNEL1_MIN_TOKENS = 60000;
var CHANNEL1_FLOOR_TOKENS = 25000;
var CHANNEL1_REFIRE_FLOOR_TOKENS = 25000;
var S_GENTLE = 0.2;
var S_FIRM = 0.4;
var S_URGENT = 0.6;
var CHANNEL2_SEVERITY_THRESHOLD = 0.75;
var CHANNEL2_FLOOR_TOKENS = 50000;
var LEVEL_RANK = { gentle: 1, firm: 2, urgent: 3 };
function channel1RefireTokens(tailTokens) {
  const scaled = Math.round(0.08 * Math.max(0, tailTokens));
  return Math.max(CHANNEL1_REFIRE_FLOOR_TOKENS, scaled);
}
function channel1Band(undroppedTokens, tailTokens) {
  if (tailTokens < CHANNEL1_MIN_TOKENS || undroppedTokens < CHANNEL1_FLOOR_TOKENS) {
    return "quiet";
  }
  const severity = Math.min(1, Math.max(0, undroppedTokens / Math.max(tailTokens, 1)));
  if (severity >= S_URGENT)
    return "urgent";
  if (severity >= S_FIRM)
    return "firm";
  if (severity >= S_GENTLE)
    return "gentle";
  return "quiet";
}
function nudgeBand(undroppedTokens, tailTokens) {
  const base = channel1Band(undroppedTokens, tailTokens);
  const severity = Math.min(1, Math.max(0, undroppedTokens / Math.max(tailTokens, 1)));
  return base === "urgent" && undroppedTokens >= CHANNEL2_FLOOR_TOKENS && severity >= CHANNEL2_SEVERITY_THRESHOLD ? "channel2" : base;
}
function decideChannel1(input) {
  const tailTokens = Math.max(0, input.baselineT + input.turnDeltaT);
  const undroppedTokens = Math.min(tailTokens, Math.max(0, input.baselineU + input.turnDeltaU));
  const severity = Math.min(1, Math.max(0, undroppedTokens / Math.max(tailTokens, 1)));
  const previousLevel = input.lastNudgeLevel;
  let lastNudge = Math.max(0, input.lastNudgeUndropped);
  let nextLevel = previousLevel;
  let clearPostReduceGrace = false;
  const growthThreshold = channel1RefireTokens(tailTokens);
  const graceBaselineU = input.postReduceGraceBaselineU === undefined ? null : Math.max(0, input.postReduceGraceBaselineU);
  const graceGrowth = graceBaselineU === null ? 0 : undroppedTokens - graceBaselineU;
  const cadenceGrowth = undroppedTokens - lastNudge;
  const currentTurn = input.currentRealUserTurnCount;
  const lastFireTurn = input.lastFireOrdinal;
  const stickyTurnsRemaining = currentTurn === undefined || lastFireTurn === undefined || lastFireTurn > currentTurn ? 0 : Math.max(0, CHANNEL1_STICKY_REAL_USER_TURN_GAP - (currentTurn - lastFireTurn));
  const measuredBand = channel1Band(undroppedTokens, tailTokens);
  const quiet = (reason, dampeningState, level = measuredBand === "quiet" ? "gentle" : measuredBand) => ({
    fire: false,
    sticky: false,
    level,
    band: measuredBand,
    undroppedTokens,
    tailTokens,
    severity,
    graceBaselineU,
    graceGrowth,
    growthThreshold,
    cadenceGrowth,
    stickyTurnsRemaining,
    dampeningState,
    verdictReason: reason,
    nextLastNudge: lastNudge,
    nextLastNudgeLevel: nextLevel,
    clearPostReduceGrace
  });
  if (input.evaluable === false || input.generationInvalidated === true) {
    return quiet("baseline-unevaluable", "baseline-hold");
  }
  if (input.hasRecentReduce)
    return quiet("recent-reduce-refresh", "baseline-hold");
  if (input.agentDropsAppliedThisPass) {
    return quiet("agent-drops-applied", "baseline-hold");
  }
  if (input.postReduceGracePending) {
    return quiet("post-reduce-baseline-pending", "baseline-hold");
  }
  const level = measuredBand === "quiet" ? "" : measuredBand;
  const previousRank = previousLevel === "" ? 0 : LEVEL_RANK[previousLevel];
  const currentRank = level === "" ? 0 : LEVEL_RANK[level];
  let graceReleaseReason = null;
  if (graceBaselineU !== null) {
    const preReduceLevel = input.postReduceGracePreLevel ?? previousLevel;
    const preReduceRank = preReduceLevel === "" ? 0 : LEVEL_RANK[preReduceLevel];
    const regrowthReached = graceGrowth >= growthThreshold;
    const escalatedAbovePreReduceBand = currentRank > preReduceRank;
    if (!regrowthReached && !escalatedAbovePreReduceBand) {
      return quiet("post-reduce-compliance-grace", "post-reduce-grace");
    }
    clearPostReduceGrace = true;
    graceReleaseReason = regrowthReached ? "post-reduce-regrowth-reached" : "post-reduce-band-escalation";
  }
  if (level === "") {
    nextLevel = "";
    lastNudge = 0;
    if (tailTokens < CHANNEL1_MIN_TOKENS) {
      return quiet("tail-below-minimum", "none");
    }
    if (undroppedTokens < CHANNEL1_FLOOR_TOKENS) {
      return quiet("reclaimable-below-floor", "none");
    }
    return quiet("ratio-below-gentle", "none");
  }
  if (currentRank < previousRank) {
    nextLevel = level;
    lastNudge = undroppedTokens;
    return quiet("band-deescalation", "band-hysteresis", level);
  }
  const crossedFromBelow = currentRank > previousRank;
  const cadenceReached = currentRank === previousRank && cadenceGrowth >= growthThreshold;
  const stickyTurnGapReached = stickyTurnsRemaining === 0;
  if (!crossedFromBelow && !cadenceReached) {
    return quiet("cadence-growth", "cadence", level);
  }
  if (!crossedFromBelow && !stickyTurnGapReached) {
    return quiet("sticky-turn-floor", "sticky-floor", level);
  }
  return {
    fire: true,
    sticky: !crossedFromBelow,
    level,
    band: measuredBand,
    undroppedTokens,
    tailTokens,
    severity,
    graceBaselineU,
    graceGrowth,
    growthThreshold,
    cadenceGrowth,
    stickyTurnsRemaining,
    dampeningState: "none",
    verdictReason: graceReleaseReason ?? (crossedFromBelow ? "band-crossing" : "cadence-refire"),
    nextLastNudge: undroppedTokens,
    nextLastNudgeLevel: level,
    clearPostReduceGrace
  };
}
function evaluateChannel2(input) {
  const unavailable = (reason) => ({
    evaluable: false,
    shouldTrigger: false,
    reclaimableTokens: 0,
    tailTokens: 0,
    severity: 0,
    band: "quiet",
    verdictReason: reason
  });
  if (!input)
    return unavailable("baseline-unavailable");
  if (input.evaluable !== true)
    return unavailable("baseline-unevaluable");
  if (input.generationInvalidated === true)
    return unavailable("generation-invalidated");
  const values = [input.baselineU, input.baselineT, input.turnDeltaU, input.turnDeltaT];
  if (values.some((value) => !Number.isFinite(value)))
    return unavailable("non-finite-input");
  const tailTokens = Math.max(0, input.baselineT + input.turnDeltaT);
  const reclaimableTokens = Math.min(tailTokens, Math.max(0, input.baselineU + input.turnDeltaU));
  const severity = Math.min(1, Math.max(0, reclaimableTokens / Math.max(tailTokens, 1)));
  const band = nudgeBand(reclaimableTokens, tailTokens);
  let verdictReason = "ceiling-threshold-met";
  if (tailTokens < CHANNEL1_MIN_TOKENS)
    verdictReason = "tail-below-minimum";
  else if (reclaimableTokens < CHANNEL2_FLOOR_TOKENS) {
    verdictReason = "reclaimable-below-floor";
  } else if (severity < CHANNEL2_SEVERITY_THRESHOLD)
    verdictReason = "ratio-below-ceiling";
  return {
    evaluable: true,
    shouldTrigger: verdictReason === "ceiling-threshold-met",
    reclaimableTokens,
    tailTokens,
    severity,
    band,
    verdictReason
  };
}
function approxThousands(tokens) {
  return `${Math.round(tokens / 1000)}k`;
}
function formatOldestReclaimableHint(hint) {
  if (!hint || hint.length === 0)
    return "";
  const rendered = hint.slice(0, 4).map((tag) => `§${tag.tagNumber}§ ${tag.toolName ?? "tool"}`).join(" · ");
  return rendered.length > 0 ? `
oldest reclaimable: ${rendered}.` : "";
}
function reclaimableToolOutputCount(parts) {
  return parts.filter((part) => part.kind === "toolOutput" && part.uTokens > 0).length;
}
function formatReclaimableOutputSummary(count, tokens) {
  const outputCount = Math.max(0, Math.floor(count));
  const outputs = outputCount === 0 ? "spent tool outputs" : `${outputCount} spent tool output${outputCount === 1 ? "" : "s"}`;
  return `${outputs} (~${approxThousands(tokens)} tokens)`;
}
function buildChannel2Reminder(undroppedTokens, reclaimableToolOutputs, hint) {
  const summary = formatReclaimableOutputSummary(reclaimableToolOutputs, undroppedTokens);
  const hintText = formatOldestReclaimableHint(hint);
  return `<system-reminder>
` + `Routine housekeeping: ${summary} are reclaimable — make a ctx_reduce pass at a natural stopping point.${hintText}
` + `</system-reminder>`;
}
var CHANNEL1_STICKY_REAL_USER_TURN_GAP = 5;
function buildChannel1Reminder(level, undroppedTokens, reclaimableToolOutputs, hint, sticky = false) {
  const summary = formatReclaimableOutputSummary(reclaimableToolOutputs, undroppedTokens);
  const hintText = formatOldestReclaimableHint(hint);
  if (sticky) {
    return `

<system-reminder>
Reminder: ${summary} are still reclaimable — ctx_reduce them at a natural stopping point.${hintText}
</system-reminder>`;
  }
  let body;
  switch (level) {
    case "gentle":
      body = `Housekeeping: ${summary} are reclaimable — drop the ones you have already processed with ctx_reduce at a natural stopping point.`;
      break;
    case "firm":
      body = `Housekeeping: ${summary} are reclaimable — make a ctx_reduce pass at a natural stopping point.`;
      break;
    case "urgent":
      body = `Housekeeping backlog: ${summary} are reclaimable — a ctx_reduce pass is due.`;
      break;
  }
  return `

<system-reminder>
${body}${hintText}
</system-reminder>`;
}

// ../plugin/src/hooks/magic-context/emergency-drop.ts
var TARGET_FRACTION = 0.3;
var TIER_RECENCY_RESERVE = 0.2;
var EMERGENCY_REARM_MIN_TOKENS = 2000;
var T1_TOOLS = new Set(["read", "todowrite", "task", "aft_outline", "aft_zoom"]);
var T2_TOOLS = new Set(["edit", "write", "apply_patch", "grep", "glob", "aft_search"]);
function normalizeToolName(toolName) {
  if (!toolName)
    return "";
  let name = toolName.toLowerCase();
  if (name.startsWith("mcp_"))
    name = name.slice(4);
  return name;
}
function resolveToolTier(toolName) {
  const name = normalizeToolName(toolName);
  if (T1_TOOLS.has(name))
    return 1;
  if (T2_TOOLS.has(name))
    return 2;
  return 3;
}
function tagReclaimBytes(tag) {
  return tag.byteSize + tag.inputByteSize + tag.reasoningByteSize;
}
function estimateEmergencyDropReclaimTokens(tag) {
  if (tag.reclaimableTokens !== undefined)
    return Number.isFinite(tag.reclaimableTokens) ? Math.max(0, tag.reclaimableTokens) : 0;
  return Math.round(tagReclaimBytes(tag) * TOKENS_PER_BYTE);
}
function planEmergencyDrop(input) {
  const {
    tags,
    floorTags,
    currentTotalInputTokens,
    ceilingTokens,
    priorInputSample,
    hasPriorDrop
  } = input;
  const noop = (reason) => ({
    shouldDrop: false,
    tagNumbers: [],
    reclaimTokens: 0,
    reason
  });
  if (!Number.isFinite(ceilingTokens) || ceilingTokens <= 0) {
    return noop("unknown-ceiling");
  }
  if (!Number.isFinite(currentTotalInputTokens) || currentTotalInputTokens <= 0) {
    return noop("unknown-usage");
  }
  const absoluteEmergency = (input.usagePercentage ?? 0) >= 95;
  if (hasPriorDrop && !absoluteEmergency) {
    return noop(`pressure-episode-latched (prior sample ${priorInputSample}; awaiting exit or independent bust)`);
  }
  let tailTokens = 0;
  for (const tag of floorTags) {
    if (tag.status !== "active")
      continue;
    tailTokens += tag.servedTokens ?? estimateEmergencyDropReclaimTokens(tag);
  }
  const fixedFloor = Math.max(currentTotalInputTokens - tailTokens, 0);
  const workingSpan = Math.max(ceilingTokens - fixedFloor, 0);
  const target = fixedFloor + TARGET_FRACTION * workingSpan;
  const reclaimTokens = Math.round(currentTotalInputTokens - target);
  if (reclaimTokens <= EMERGENCY_REARM_MIN_TOKENS) {
    return noop(`reclaim<=min (${reclaimTokens} <= ${EMERGENCY_REARM_MIN_TOKENS})`);
  }
  const cutoff = input.protectedCutoff;
  const windowYields = absoluteEmergency;
  const tierActive = { 1: [], 2: [] };
  for (const tag of tags) {
    if (tag.status !== "active" || tag.type !== "tool")
      continue;
    const tier = resolveToolTier(tag.toolName);
    if (tier === 1 || tier === 2)
      tierActive[tier].push(tag.tagNumber);
  }
  const reserved = new Set;
  for (const tier of [1, 2]) {
    const nums = tierActive[tier];
    if (nums.length === 0)
      continue;
    nums.sort((a, b) => b - a);
    const reserveCount = absoluteEmergency ? 0 : Math.ceil(TIER_RECENCY_RESERVE * nums.length);
    for (let i = 0;i < reserveCount && i < nums.length; i++) {
      reserved.add(nums[i]);
    }
  }
  const protectedCtxReduceTags = newestCtxReduceTagNumbers(floorTags.filter((tag) => tag.status === "active" && tag.type === "tool"));
  const byTier = { 1: [], 2: [], 3: [] };
  for (const tag of tags) {
    if (tag.status !== "active" || tag.type !== "tool")
      continue;
    if (!windowYields) {
      if (cutoff !== null) {
        if (tag.tagNumber >= cutoff)
          continue;
      }
    }
    if (protectedCtxReduceTags.has(tag.tagNumber))
      continue;
    const tier = resolveToolTier(tag.toolName);
    if ((tier === 1 || tier === 2) && reserved.has(tag.tagNumber))
      continue;
    byTier[tier].push(tag);
  }
  const selected = [];
  let reclaimed = 0;
  outer:
    for (const tier of [3, 2, 1]) {
      const group = byTier[tier];
      group.sort((a, b) => a.tagNumber - b.tagNumber);
      for (const tag of group) {
        selected.push(tag.tagNumber);
        reclaimed += estimateEmergencyDropReclaimTokens(tag);
        if (reclaimed >= reclaimTokens)
          break outer;
      }
    }
  if (selected.length === 0) {
    return noop("no-candidates");
  }
  return {
    shouldDrop: true,
    tagNumbers: selected,
    reclaimTokens,
    reason: `tiered drop: ${selected.length} tags, reclaim≈${reclaimed}/${reclaimTokens} tokens (floor≈${fixedFloor}, ceiling=${Math.round(ceilingTokens)})`
  };
}
function measureEmergencyTag(tag, target, calibration, skeleton) {
  const observation = target?.measureReclaim?.(skeleton);
  if (observation) {
    const before = observation.beforeTools * calibration.toolsRatio + observation.beforeProse * calibration.proseRatio;
    const after = observation.afterTools * calibration.toolsRatio + observation.afterProse * calibration.proseRatio;
    return { ...tag, servedTokens: before, reclaimableTokens: Math.max(0, before - after) };
  }
  const content = target?.getContent?.();
  const served = content ? estimateTokens(content) * (tag.type === "tool" ? calibration.toolsRatio : calibration.proseRatio) : 0;
  return { ...tag, servedTokens: served, reclaimableTokens: 0 };
}

// ../plugin/src/features/magic-context/storage-tags.ts
var insertTagStatements = new WeakMap;
var updateTagStatusStatements = new WeakMap;
var updateTagDropModeStatements = new WeakMap;
var updateTagMessageIdStatements = new WeakMap;
var getTagNumbersByMessageIdStatements = new WeakMap;
var deleteTagsByMessageIdStatements = new WeakMap;
var getMaxTagNumberBySessionStatements = new WeakMap;
var getTagNumberByMessageIdStatements = new WeakMap;
var getAssignableTagNumberByMessageIdStatements = new WeakMap;
var hasPiFallbackMessageTagStatements = new WeakMap;
var WHITESPACE_ASSISTANT_INERT_MESSAGE_PREFIX = "__mc_whitespace_assistant_inert__:";
var WHITESPACE_ASSISTANT_INERT_FINGERPRINT_PREFIX = "mc:whitespace-assistant:";
function getInsertTagStatement(db) {
  let stmt = insertTagStatements.get(db);
  if (!stmt) {
    stmt = db.prepare("INSERT INTO tags (session_id, message_id, type, byte_size, reasoning_byte_size, tag_number, tool_name, input_byte_size, harness, tool_owner_message_id, entry_fingerprint, token_count, input_token_count, reasoning_token_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    insertTagStatements.set(db, stmt);
  }
  return stmt;
}
function getUpdateTagStatusStatement(db) {
  let stmt = updateTagStatusStatements.get(db);
  if (!stmt) {
    stmt = db.prepare("UPDATE tags SET status = ? WHERE session_id = ? AND tag_number = ?");
    updateTagStatusStatements.set(db, stmt);
  }
  return stmt;
}
function getUpdateTagDropModeStatement(db) {
  let stmt = updateTagDropModeStatements.get(db);
  if (!stmt) {
    stmt = db.prepare("UPDATE tags SET drop_mode = ? WHERE session_id = ? AND tag_number = ?");
    updateTagDropModeStatements.set(db, stmt);
  }
  return stmt;
}
var updateTagByteSizeStatements = new WeakMap;
var updateTagInputByteSizeStatements = new WeakMap;
function getUpdateTagByteSizeStatement(db) {
  let stmt = updateTagByteSizeStatements.get(db);
  if (!stmt) {
    stmt = db.prepare("UPDATE tags SET byte_size = ? WHERE session_id = ? AND tag_number = ?");
    updateTagByteSizeStatements.set(db, stmt);
  }
  return stmt;
}
function getUpdateTagInputByteSizeStatement(db) {
  let stmt = updateTagInputByteSizeStatements.get(db);
  if (!stmt) {
    stmt = db.prepare("UPDATE tags SET input_byte_size = ? WHERE session_id = ? AND tag_number = ?");
    updateTagInputByteSizeStatements.set(db, stmt);
  }
  return stmt;
}
function updateTagByteSize(db, sessionId, tagNumber, newByteSize) {
  getUpdateTagByteSizeStatement(db).run(newByteSize, sessionId, tagNumber);
}
var CONTENT_ID_SUFFIX = /:(?:p|file)\d+$/;
var RECENT_OWNER_SCAN_PAGE_SIZE = 128;
var recentTagOwnerStatements = new WeakMap;
function ownerMessageIdForTagRow(row) {
  if (row.type === "tool") {
    return row.tool_owner_message_id ?? row.message_id;
  }
  return row.message_id.replace(CONTENT_ID_SUFFIX, "");
}
function getRecentTagOwnerStatement(db) {
  let statement = recentTagOwnerStatements.get(db);
  if (!statement) {
    statement = db.prepare(`SELECT type, message_id, tool_owner_message_id
             FROM tags
             WHERE session_id = ?
             ORDER BY tag_number DESC, id DESC
             LIMIT ? OFFSET ?`);
    recentTagOwnerStatements.set(db, statement);
  }
  return statement;
}
function getRecentTagOwnerMessageIds(db, sessionId, maxOwners) {
  const recent = new Set;
  if (!Number.isFinite(maxOwners) || maxOwners <= 0)
    return recent;
  const statement = getRecentTagOwnerStatement(db);
  let offset = 0;
  while (recent.size < maxOwners) {
    const rows = statement.all(sessionId, RECENT_OWNER_SCAN_PAGE_SIZE, offset);
    for (const row of rows) {
      if (typeof row.type !== "string" || typeof row.message_id !== "string")
        continue;
      const ownerId = row.type === "tool" ? typeof row.tool_owner_message_id === "string" ? row.tool_owner_message_id : null : row.message_id.replace(CONTENT_ID_SUFFIX, "");
      if (!ownerId || recent.has(ownerId))
        continue;
      recent.add(ownerId);
      if (recent.size >= maxOwners)
        break;
    }
    if (rows.length < RECENT_OWNER_SCAN_PAGE_SIZE)
      break;
    offset += rows.length;
  }
  return recent;
}
var RECLAIM_HINT_EXCLUDED_TOOLS = new Set([
  "ask",
  "bash_kill",
  "bash_status",
  "board",
  "task",
  "todoread",
  "todowrite",
  "work"
]);
var AGE_RECLAIM_MIN_TOKENS = 250;
function isReclaimHintExcludedTool(toolName) {
  if (!toolName)
    return false;
  const normalized = toolName.toLowerCase().replace(/^mcp_/, "");
  return normalized.startsWith("ctx_") || RECLAIM_HINT_EXCLUDED_TOOLS.has(normalized);
}
function getOldestActiveUnprotectedToolTags(db, sessionId, protectedTagNumbers = new Set, limit = 4) {
  if (limit <= 0)
    return [];
  const boundedLimit = Math.max(1, Math.min(10, Math.floor(limit)));
  const valueFloor = `AND (
            (token_count IS NULL AND input_token_count IS NULL)
            OR (COALESCE(token_count, 0) + COALESCE(input_token_count, 0)) >= ?
        )`;
  const params = [sessionId, AGE_RECLAIM_MIN_TOKENS];
  const rows = db.prepare(`SELECT tag_number, tool_name
             FROM tags
               WHERE session_id = ? AND status = 'active' AND type = 'tool'
                    AND NOT EXISTS (
                        SELECT 1 FROM pending_ops
                        WHERE pending_ops.session_id = tags.session_id
                          AND pending_ops.tag_id = tags.tag_number
                          AND pending_ops.operation = 'drop'
                    )
                     ${valueFloor}
              ORDER BY tag_number ASC, id ASC`).all(...params);
  return rows.filter((row) => typeof row.tag_number === "number").map((row) => ({
    tagNumber: row.tag_number,
    toolName: typeof row.tool_name === "string" ? row.tool_name : null
  })).filter((tag) => !protectedTagNumbers.has(tag.tagNumber) && !isReclaimHintExcludedTool(tag.toolName)).sort((left, right) => resolveToolTier(right.toolName) - resolveToolTier(left.toolName) || left.tagNumber - right.tagNumber).slice(0, boundedLimit);
}
var getActiveToolTagsForAgeReclaimStatements = new WeakMap;
function getActiveToolTagsForAgeReclaim(db, sessionId) {
  let stmt = getActiveToolTagsForAgeReclaimStatements.get(db);
  if (!stmt) {
    stmt = db.prepare(`SELECT tag_number, tool_name, token_count, input_token_count
             FROM tags
             WHERE session_id = ? AND status = 'active' AND type = 'tool'
             ORDER BY tag_number ASC, id ASC`);
    getActiveToolTagsForAgeReclaimStatements.set(db, stmt);
  }
  const rows = stmt.all(sessionId);
  const tags = rows.filter((row) => typeof row.tag_number === "number").map((row) => {
    const outputTokens = typeof row.token_count === "number" ? row.token_count : null;
    const inputTokens = typeof row.input_token_count === "number" ? row.input_token_count : null;
    return {
      tagNumber: row.tag_number,
      toolName: typeof row.tool_name === "string" ? row.tool_name : null,
      reclaimableTokens: outputTokens === null && inputTokens === null ? null : (outputTokens ?? 0) + (inputTokens ?? 0)
    };
  });
  const protectedCtxReduceTags = newestCtxReduceTagNumbers(tags);
  return tags.filter((tag) => !protectedCtxReduceTags.has(tag.tagNumber));
}
function getTriggerTagTokenUpperBound(db, sessionId, floor = 0) {
  const sql = floor > 0 ? `SELECT
                COALESCE(SUM(COALESCE(token_count, 0) + COALESCE(input_token_count, 0) + COALESCE(reasoning_token_count, 0)), 0) AS bound,
                COALESCE(SUM(CASE WHEN token_count IS NULL THEN 1 ELSE 0 END), 0) AS null_count
             FROM tags
             WHERE session_id = ? AND status IN ('active', 'dropped') AND tag_number >= ?` : `SELECT
                COALESCE(SUM(COALESCE(token_count, 0) + COALESCE(input_token_count, 0) + COALESCE(reasoning_token_count, 0)), 0) AS bound,
                COALESCE(SUM(CASE WHEN token_count IS NULL THEN 1 ELSE 0 END), 0) AS null_count
             FROM tags
             WHERE session_id = ? AND status IN ('active', 'dropped')`;
  const row = floor > 0 ? db.prepare(sql).get(sessionId, floor) : db.prepare(sql).get(sessionId);
  return { bound: row?.bound ?? 0, nullCount: row?.null_count ?? 0 };
}
function updateTagInputByteSize(db, sessionId, tagNumber, newInputByteSize) {
  getUpdateTagInputByteSizeStatement(db).run(newInputByteSize, sessionId, tagNumber);
}
var updateTagTokenCountStatements = new WeakMap;
var updateTagInputTokenCountStatements = new WeakMap;
function getUpdateTagTokenCountStatement(db) {
  let stmt = updateTagTokenCountStatements.get(db);
  if (!stmt) {
    stmt = db.prepare("UPDATE tags SET token_count = MAX(COALESCE(token_count, 0), ?) WHERE session_id = ? AND tag_number = ?");
    updateTagTokenCountStatements.set(db, stmt);
  }
  return stmt;
}
function getUpdateTagInputTokenCountStatement(db) {
  let stmt = updateTagInputTokenCountStatements.get(db);
  if (!stmt) {
    stmt = db.prepare("UPDATE tags SET input_token_count = ? WHERE session_id = ? AND tag_number = ?");
    updateTagInputTokenCountStatements.set(db, stmt);
  }
  return stmt;
}
function updateTagTokenCount(db, sessionId, tagNumber, newTokenCount) {
  getUpdateTagTokenCountStatement(db).run(newTokenCount, sessionId, tagNumber);
}
function getPersistedToolTagAccounting(db, sessionId, tagNumber) {
  const row = db.prepare(`SELECT byte_size AS byteSize,
                    token_count AS tokenCount,
                    input_byte_size AS inputByteSize,
                    input_token_count AS inputTokenCount
             FROM tags
             WHERE session_id = ? AND tag_number = ? AND type = 'tool'`).get(sessionId, tagNumber);
  if (!row || typeof row.byteSize !== "number" || row.tokenCount !== null && typeof row.tokenCount !== "number" || typeof row.inputByteSize !== "number" || row.inputTokenCount !== null && typeof row.inputTokenCount !== "number") {
    return null;
  }
  return row;
}
function getAllStatusTagTokenTotalsFlat(db, sessionId, floor = 0, calibration = { proseRatio: 1, toolsRatio: 1 }) {
  const rows = floor > 0 ? db.prepare(`SELECT type, message_id, tool_owner_message_id, token_count, input_token_count, reasoning_token_count
                       FROM tags
                       WHERE session_id = ? AND tag_number >= ?`).all(sessionId, floor) : db.prepare(`SELECT type, message_id, tool_owner_message_id, token_count, input_token_count, reasoning_token_count
                       FROM tags
                       WHERE session_id = ?`).all(sessionId);
  const totals = new Map;
  const nullMessageIds = new Set;
  for (const row of rows) {
    if (row.type === "tool" && row.tool_owner_message_id === null)
      continue;
    const owner = ownerMessageIdForTagRow(row);
    if (row.token_count === null) {
      nullMessageIds.add(owner);
      totals.delete(owner);
      continue;
    }
    if (nullMessageIds.has(owner))
      continue;
    const ratio = row.type === "tool" ? calibration.toolsRatio : calibration.proseRatio;
    const weight = ((row.token_count ?? 0) + (row.input_token_count ?? 0)) * ratio + (row.reasoning_token_count ?? 0) * calibration.proseRatio;
    totals.set(owner, (totals.get(owner) ?? 0) + weight);
  }
  return { totals, nullMessageIds };
}
function updateTagInputTokenCount(db, sessionId, tagNumber, newInputTokenCount) {
  getUpdateTagInputTokenCountStatement(db).run(newInputTokenCount, sessionId, tagNumber);
}
function tagTokenCountIsNull(db, sessionId, tagNumber) {
  const row = db.prepare("SELECT token_count FROM tags WHERE session_id = ? AND tag_number = ?").get(sessionId, tagNumber);
  return row != null && row.token_count === null;
}
function backfillTagTokenCounts(db, sessionId, tagNumber, counts) {
  db.prepare(`UPDATE tags
            SET token_count = CASE WHEN ? IS NOT NULL THEN MAX(COALESCE(token_count, 0), ?) ELSE token_count END,
                input_token_count = ?,
                reasoning_token_count = ?
            WHERE session_id = ? AND tag_number = ? AND token_count IS NULL`).run(counts.tokenCount ?? null, counts.tokenCount ?? null, counts.inputTokenCount ?? null, counts.reasoningTokenCount ?? null, sessionId, tagNumber);
}
function getMaxTagNumberBySessionStatement(db) {
  let stmt = getMaxTagNumberBySessionStatements.get(db);
  if (!stmt) {
    stmt = db.prepare("SELECT COALESCE(MAX(tag_number), 0) AS max_tag_number FROM tags WHERE session_id = ?");
    getMaxTagNumberBySessionStatements.set(db, stmt);
  }
  return stmt;
}
function getTagNumberByMessageIdStatement(db) {
  let stmt = getTagNumberByMessageIdStatements.get(db);
  if (!stmt) {
    stmt = db.prepare("SELECT tag_number FROM tags WHERE session_id = ? AND message_id = ? ORDER BY tag_number ASC LIMIT 1");
    getTagNumberByMessageIdStatements.set(db, stmt);
  }
  return stmt;
}
function getAssignableTagNumberByMessageIdStatement(db) {
  let stmt = getAssignableTagNumberByMessageIdStatements.get(db);
  if (!stmt) {
    stmt = db.prepare(`SELECT tag_number FROM tags
             WHERE session_id = ?
               AND message_id = ?
               AND NOT (
                   status = 'compacted'
                   AND COALESCE(
                       entry_fingerprint LIKE '${WHITESPACE_ASSISTANT_INERT_FINGERPRINT_PREFIX}%',
                       0
                   ) = 1
               )
             ORDER BY tag_number ASC
             LIMIT 1`);
    getAssignableTagNumberByMessageIdStatements.set(db, stmt);
  }
  return stmt;
}
function isTagRow(row) {
  if (row === null || typeof row !== "object")
    return false;
  const r = row;
  return typeof r.id === "number" && typeof r.message_id === "string" && typeof r.type === "string" && typeof r.status === "string" && typeof r.byte_size === "number" && typeof r.session_id === "string" && typeof r.tag_number === "number";
}
function toTagEntry(row) {
  const type = row.type === "tool" ? "tool" : row.type === "file" ? "file" : "message";
  const status = row.status === "dropped" || row.status === "compacted" ? row.status : "active";
  return {
    id: row.id,
    tagNumber: row.tag_number,
    messageId: row.message_id,
    type,
    status,
    dropMode: row.drop_mode === "truncated" ? "truncated" : row.drop_mode === "edit_marker" ? "edit_marker" : "full",
    toolName: row.tool_name ?? null,
    inputByteSize: row.input_byte_size ?? 0,
    byteSize: row.byte_size,
    reasoningByteSize: row.reasoning_byte_size ?? 0,
    sessionId: row.session_id,
    cavemanDepth: typeof row.caveman_depth === "number" && Number.isFinite(row.caveman_depth) ? row.caveman_depth : 0,
    toolOwnerMessageId: typeof row.tool_owner_message_id === "string" ? row.tool_owner_message_id : null,
    tokenCount: typeof row.token_count === "number" ? row.token_count : null
  };
}
function isTagNumberRow(row) {
  if (row === null || typeof row !== "object")
    return false;
  const r = row;
  return typeof r.tag_number === "number";
}
function isMaxTagNumberRow(row) {
  if (row === null || typeof row !== "object")
    return false;
  const r = row;
  return typeof r.max_tag_number === "number";
}
function insertTag(db, sessionId, messageId, type, byteSize, tagNumber, reasoningByteSize = 0, toolName = null, inputByteSize = 0, toolOwnerMessageId = null, entryFingerprint = null, tokenCounts = null) {
  getInsertTagStatement(db).run(sessionId, messageId, type, byteSize, reasoningByteSize, tagNumber, toolName, inputByteSize, getHarness(), toolOwnerMessageId, entryFingerprint, tokenCounts?.tokenCount ?? null, tokenCounts?.inputTokenCount ?? null, tokenCounts?.reasoningTokenCount ?? null);
  return tagNumber;
}
function updateTagStatus(db, sessionId, tagId, status) {
  getUpdateTagStatusStatement(db).run(status, sessionId, tagId);
}
function getInertWhitespaceAssistantTags(db, sessionId) {
  const rows = db.prepare(`SELECT tag_number AS tagNumber, entry_fingerprint AS entryFingerprint
             FROM tags
             WHERE session_id = ?
               AND type = 'message'
               AND status = 'compacted'
               AND entry_fingerprint LIKE ?`).all(sessionId, `${WHITESPACE_ASSISTANT_INERT_FINGERPRINT_PREFIX}%`);
  return rows.flatMap((row) => {
    const contentId = row.entryFingerprint.slice(WHITESPACE_ASSISTANT_INERT_FINGERPRINT_PREFIX.length);
    return contentId.length > 0 ? [{ tagNumber: row.tagNumber, contentId }] : [];
  });
}
function updateTagDropMode(db, sessionId, tagNumber, dropMode) {
  getUpdateTagDropModeStatement(db).run(dropMode, sessionId, tagNumber);
}
function updateCavemanDepth(db, sessionId, tagNumber, depth) {
  db.prepare("UPDATE tags SET caveman_depth = ? WHERE session_id = ? AND tag_number = ?").run(depth, sessionId, tagNumber);
}
function hasPiFallbackMessageTags(db, sessionId) {
  let statement = hasPiFallbackMessageTagStatements.get(db);
  if (!statement) {
    statement = db.prepare(`SELECT 1
             FROM tags
             WHERE session_id = ?
               AND type = 'message'
               AND message_id LIKE 'pi-msg-%'
             LIMIT 1`);
    hasPiFallbackMessageTagStatements.set(db, statement);
  }
  return statement.get(sessionId) != null;
}
function findAdoptableFallbackTags(db, sessionId, entryFingerprint) {
  const rows = db.prepare(`SELECT tag_number AS tagNumber, message_id AS messageId
             FROM tags
             WHERE session_id = ?
               AND type = 'message'
               AND entry_fingerprint = ?
               AND message_id LIKE 'pi-msg-%'`).all(sessionId, entryFingerprint);
  return rows;
}
function isPiFallbackToolOwnerTag(row) {
  if (row === null || typeof row !== "object")
    return false;
  const r = row;
  return typeof r.tagNumber === "number" && typeof r.callId === "string" && typeof r.toolOwnerMessageId === "string" && typeof r.status === "string";
}
function isPiFallbackFoldTagRow(row) {
  if (row === null || typeof row !== "object")
    return false;
  const r = row;
  return typeof r.tagNumber === "number" && typeof r.messageId === "string" && (typeof r.toolOwnerMessageId === "string" || r.toolOwnerMessageId === null) && typeof r.type === "string" && typeof r.status === "string" && (typeof r.byteSize === "number" || r.byteSize === null) && (typeof r.reasoningByteSize === "number" || r.reasoningByteSize === null) && (typeof r.inputByteSize === "number" || r.inputByteSize === null) && (typeof r.tokenCount === "number" || r.tokenCount === null) && (typeof r.inputTokenCount === "number" || r.inputTokenCount === null) && (typeof r.reasoningTokenCount === "number" || r.reasoningTokenCount === null);
}
function isPendingOpIdentityRow(row) {
  if (row === null || typeof row !== "object")
    return false;
  const r = row;
  return typeof r.id === "number" && typeof r.operation === "string";
}
function maxNullableNumber(a, b) {
  if (typeof a === "number" && typeof b === "number")
    return Math.max(a, b);
  if (typeof a === "number")
    return a;
  if (typeof b === "number")
    return b;
  return null;
}
function getPiFallbackFoldTagRowByNumber(db, sessionId, tagNumber) {
  const row = db.prepare(`SELECT tag_number AS tagNumber,
                    message_id AS messageId,
                    tool_owner_message_id AS toolOwnerMessageId,
                    type,
                    status,
                    byte_size AS byteSize,
                    reasoning_byte_size AS reasoningByteSize,
                    input_byte_size AS inputByteSize,
                    token_count AS tokenCount,
                    input_token_count AS inputTokenCount,
                    reasoning_token_count AS reasoningTokenCount
             FROM tags
             WHERE session_id = ? AND tag_number = ?`).get(sessionId, tagNumber);
  return isPiFallbackFoldTagRow(row) ? row : null;
}
function getPiFallbackToolFoldTagRowByOwner(db, sessionId, callId, ownerMsgId) {
  const row = db.prepare(`SELECT tag_number AS tagNumber,
                    message_id AS messageId,
                    tool_owner_message_id AS toolOwnerMessageId,
                    type,
                    status,
                    byte_size AS byteSize,
                    reasoning_byte_size AS reasoningByteSize,
                    input_byte_size AS inputByteSize,
                    token_count AS tokenCount,
                    input_token_count AS inputTokenCount,
                    reasoning_token_count AS reasoningTokenCount
             FROM tags
             WHERE session_id = ?
               AND message_id = ?
               AND type = 'tool'
               AND tool_owner_message_id = ?
             LIMIT 1`).get(sessionId, callId, ownerMsgId);
  return isPiFallbackFoldTagRow(row) ? row : null;
}
function getPiFallbackMessageFoldTagRowsByMessageId(db, sessionId, messageId) {
  return db.prepare(`SELECT tag_number AS tagNumber,
                    message_id AS messageId,
                    tool_owner_message_id AS toolOwnerMessageId,
                    type,
                    status,
                    byte_size AS byteSize,
                    reasoning_byte_size AS reasoningByteSize,
                    input_byte_size AS inputByteSize,
                    token_count AS tokenCount,
                    input_token_count AS inputTokenCount,
                    reasoning_token_count AS reasoningTokenCount
             FROM tags
             WHERE session_id = ?
               AND message_id = ?
               AND type = 'message'
             ORDER BY tag_number ASC`).all(sessionId, messageId).filter(isPiFallbackFoldTagRow);
}
function mergeSizeAndTokenColumnsIntoSurvivor(db, sessionId, survivor, duplicate) {
  db.prepare(`UPDATE tags
         SET byte_size = ?,
             reasoning_byte_size = ?,
             input_byte_size = ?,
             token_count = ?,
             input_token_count = ?,
             reasoning_token_count = ?
         WHERE session_id = ? AND tag_number = ?`).run(maxNullableNumber(survivor.byteSize, duplicate.byteSize), maxNullableNumber(survivor.reasoningByteSize, duplicate.reasoningByteSize), maxNullableNumber(survivor.inputByteSize, duplicate.inputByteSize), maxNullableNumber(survivor.tokenCount, duplicate.tokenCount), maxNullableNumber(survivor.inputTokenCount, duplicate.inputTokenCount), maxNullableNumber(survivor.reasoningTokenCount, duplicate.reasoningTokenCount), sessionId, survivor.tagNumber);
  survivor.byteSize = maxNullableNumber(survivor.byteSize, duplicate.byteSize);
  survivor.reasoningByteSize = maxNullableNumber(survivor.reasoningByteSize, duplicate.reasoningByteSize);
  survivor.inputByteSize = maxNullableNumber(survivor.inputByteSize, duplicate.inputByteSize);
  survivor.tokenCount = maxNullableNumber(survivor.tokenCount, duplicate.tokenCount);
  survivor.inputTokenCount = maxNullableNumber(survivor.inputTokenCount, duplicate.inputTokenCount);
  survivor.reasoningTokenCount = maxNullableNumber(survivor.reasoningTokenCount, duplicate.reasoningTokenCount);
}
function applyDroppedStatusIfNeeded(db, sessionId, survivor, duplicate) {
  if (survivor.status === "dropped")
    return;
  if (duplicate.status !== "dropped")
    return;
  db.prepare("UPDATE tags SET status = 'dropped' WHERE session_id = ? AND tag_number = ?").run(sessionId, survivor.tagNumber);
  survivor.status = "dropped";
}
function retargetPendingOps(db, sessionId, fromTagNumber, toTagNumber) {
  const rows = db.prepare(`SELECT id, operation
             FROM pending_ops
             WHERE session_id = ? AND tag_id = ?
             ORDER BY id ASC`).all(sessionId, fromTagNumber).filter(isPendingOpIdentityRow);
  for (const row of rows) {
    const existing = db.prepare(`SELECT 1
                 FROM pending_ops
                 WHERE session_id = ? AND tag_id = ? AND operation = ?
                 LIMIT 1`).get(sessionId, toTagNumber, row.operation);
    if (existing) {
      db.prepare("DELETE FROM pending_ops WHERE session_id = ? AND id = ?").run(sessionId, row.id);
    } else {
      db.prepare("UPDATE pending_ops SET tag_id = ? WHERE session_id = ? AND id = ?").run(toTagNumber, sessionId, row.id);
    }
  }
  db.prepare("DELETE FROM pending_ops WHERE session_id = ? AND tag_id = ?").run(sessionId, fromTagNumber);
}
function deleteFoldedDuplicateTag(db, sessionId, tagNumber) {
  db.prepare("DELETE FROM source_contents WHERE session_id = ? AND tag_id = ?").run(sessionId, tagNumber);
  db.prepare("DELETE FROM tags WHERE session_id = ? AND tag_number = ?").run(sessionId, tagNumber);
  db.prepare("DELETE FROM pending_ops WHERE session_id = ? AND tag_id = ?").run(sessionId, tagNumber);
}
function foldDuplicateIntoSurvivor(db, sessionId, survivor, duplicate) {
  mergeSizeAndTokenColumnsIntoSurvivor(db, sessionId, survivor, duplicate);
  applyDroppedStatusIfNeeded(db, sessionId, survivor, duplicate);
  retargetPendingOps(db, sessionId, duplicate.tagNumber, survivor.tagNumber);
  deleteFoldedDuplicateTag(db, sessionId, duplicate.tagNumber);
}
function hasPiFallbackToolOwnerTags(db, sessionId) {
  const row = db.prepare(`SELECT 1
             FROM tags
             WHERE session_id = ?
               AND type = 'tool'
               AND tool_owner_message_id LIKE 'pi-msg-%'
             LIMIT 1`).get(sessionId);
  return row != null;
}
function findPiFallbackToolOwnerTags(db, sessionId) {
  return db.prepare(`SELECT tag_number AS tagNumber,
                    message_id AS callId,
                    tool_owner_message_id AS toolOwnerMessageId,
                    status
             FROM tags
             WHERE session_id = ?
               AND type = 'tool'
               AND tool_owner_message_id LIKE 'pi-msg-%'
             ORDER BY tag_number ASC`).all(sessionId).filter(isPiFallbackToolOwnerTag);
}
function adoptPiFallbackToolOwnerTag(db, sessionId, tagNumber, callId, oldOwnerMessageId, newOwnerMessageId) {
  const survivor = getPiFallbackFoldTagRowByNumber(db, sessionId, tagNumber);
  if (survivor === null || survivor.type !== "tool" || survivor.messageId !== callId || survivor.toolOwnerMessageId !== oldOwnerMessageId) {
    return { action: "skipped" };
  }
  const existing = getPiFallbackToolFoldTagRowByOwner(db, sessionId, callId, newOwnerMessageId);
  if (existing === null) {
    const result = db.prepare(`UPDATE tags
                 SET tool_owner_message_id = ?
                 WHERE session_id = ?
                   AND tag_number = ?
                   AND type = 'tool'
                   AND message_id = ?
                   AND tool_owner_message_id = ?`).run(newOwnerMessageId, sessionId, tagNumber, callId, oldOwnerMessageId);
    return (result.changes ?? 0) > 0 ? { action: "rekeyed", tagNumber } : { action: "skipped" };
  }
  if (existing.tagNumber === tagNumber) {
    return { action: "skipped" };
  }
  foldDuplicateIntoSurvivor(db, sessionId, existing, survivor);
  return {
    action: "folded",
    tagNumber: existing.tagNumber,
    deletedTagNumbers: [tagNumber]
  };
}
function adoptPiFallbackMessageTag(db, sessionId, tagNumber, oldFallbackMessageId, newRealMessageId) {
  if (oldFallbackMessageId.startsWith(WHITESPACE_ASSISTANT_INERT_MESSAGE_PREFIX)) {
    return { action: "skipped" };
  }
  const survivor = getPiFallbackFoldTagRowByNumber(db, sessionId, tagNumber);
  if (survivor === null || survivor.type !== "message" || survivor.messageId !== oldFallbackMessageId) {
    return { action: "skipped" };
  }
  const duplicates = getPiFallbackMessageFoldTagRowsByMessageId(db, sessionId, newRealMessageId).filter((row) => row.tagNumber !== tagNumber);
  if (duplicates.length === 0) {
    const result = db.prepare(`UPDATE tags
                 SET message_id = ?
                 WHERE session_id = ?
                   AND tag_number = ?
                   AND type = 'message'
                   AND message_id = ?`).run(newRealMessageId, sessionId, tagNumber, oldFallbackMessageId);
    return (result.changes ?? 0) > 0 ? { action: "rekeyed", tagNumber } : { action: "skipped" };
  }
  const realSurvivor = duplicates[0];
  if (!realSurvivor)
    return { action: "skipped" };
  const deletedTagNumbers = [tagNumber];
  foldDuplicateIntoSurvivor(db, sessionId, realSurvivor, survivor);
  for (const duplicate of duplicates.slice(1)) {
    foldDuplicateIntoSurvivor(db, sessionId, realSurvivor, duplicate);
    deletedTagNumbers.push(duplicate.tagNumber);
  }
  return {
    action: "folded",
    tagNumber: realSurvivor.tagNumber,
    deletedTagNumbers
  };
}
var getOwnerScopedToolTagNumbersStatements = new WeakMap;
function getMaxTagNumberBySession(db, sessionId) {
  const row = getMaxTagNumberBySessionStatement(db).get(sessionId);
  return isMaxTagNumberRow(row) ? row.max_tag_number : 0;
}
function getTagNumberByMessageId(db, sessionId, messageId) {
  const row = getTagNumberByMessageIdStatement(db).get(sessionId, messageId);
  return isTagNumberRow(row) ? row.tag_number : null;
}
function getAssignableTagNumberByMessageId(db, sessionId, messageId) {
  const row = getAssignableTagNumberByMessageIdStatement(db).get(sessionId, messageId);
  return isTagNumberRow(row) ? row.tag_number : null;
}
var getMinMessageTagNumberForRawIdStatements = new WeakMap;
function isMinTagNumberRow(row) {
  return row !== null && typeof row === "object" && "m" in row;
}
function getMinMessageTagNumberForRawId(db, sessionId, rawId) {
  if (rawId.includes(":"))
    return null;
  let stmt = getMinMessageTagNumberForRawIdStatements.get(db);
  if (!stmt) {
    stmt = db.prepare("SELECT MIN(tag_number) AS m FROM tags WHERE session_id = ? AND message_id >= ? AND message_id < ?");
    getMinMessageTagNumberForRawIdStatements.set(db, stmt);
  }
  const row = stmt.get(sessionId, `${rawId}:`, `${rawId};`);
  return isMinTagNumberRow(row) && typeof row.m === "number" ? row.m : null;
}
var TAGGER_FLOOR_SCAN_MESSAGES = 8;
var TAGGER_FLOOR_MAX_PROBES = 64;
var TAGGER_FLOOR_SAFETY_MARGIN = 256;
var TAGGER_FLOOR_PER_SKIP_MARGIN = 64;
function deriveTagLoadFloor(db, sessionId, rawIds) {
  let min = Number.POSITIVE_INFINITY;
  let probes = 0;
  let hits = 0;
  let skippedBeforeFirstHit = 0;
  for (const rawId of rawIds) {
    if (typeof rawId !== "string" || rawId.length === 0)
      continue;
    if (probes >= TAGGER_FLOOR_MAX_PROBES)
      break;
    probes++;
    const m = getMinMessageTagNumberForRawId(db, sessionId, rawId);
    if (m === null) {
      if (hits === 0)
        skippedBeforeFirstHit++;
      continue;
    }
    if (m < min)
      min = m;
    if (++hits >= TAGGER_FLOOR_SCAN_MESSAGES)
      break;
  }
  if (!Number.isFinite(min))
    return 0;
  const margin = TAGGER_FLOOR_SAFETY_MARGIN + skippedBeforeFirstHit * TAGGER_FLOOR_PER_SKIP_MARGIN;
  return Math.max(0, min - margin);
}
var TAG_SELECT_COLUMNS = "id, message_id, type, status, drop_mode, tool_name, input_byte_size, byte_size, reasoning_byte_size, session_id, tag_number, caveman_depth, tool_owner_message_id, token_count";
function getTagsBySession(db, sessionId) {
  const rows = db.prepare(`SELECT ${TAG_SELECT_COLUMNS} FROM tags WHERE session_id = ? ORDER BY tag_number ASC, id ASC`).all(sessionId).filter(isTagRow);
  return rows.map(toTagEntry);
}
var getActiveTagsBySessionStatements = new WeakMap;
var getNullOwnerToolTagsBySessionStatements = new WeakMap;
var getDroppedTagsBySessionStatements = new WeakMap;
var getMaxDroppedTagNumberStatements = new WeakMap;
function getActiveTagsBySessionStatement(db) {
  let stmt = getActiveTagsBySessionStatements.get(db);
  if (!stmt) {
    stmt = db.prepare(`SELECT ${TAG_SELECT_COLUMNS} FROM tags WHERE session_id = ? AND status = 'active' ORDER BY tag_number ASC, id ASC`);
    getActiveTagsBySessionStatements.set(db, stmt);
  }
  return stmt;
}
function getMaxDroppedTagNumberStatement(db) {
  let stmt = getMaxDroppedTagNumberStatements.get(db);
  if (!stmt) {
    stmt = db.prepare("SELECT COALESCE(MAX(tag_number), 0) AS max_tag_number FROM tags WHERE session_id = ? AND status = 'dropped'");
    getMaxDroppedTagNumberStatements.set(db, stmt);
  }
  return stmt;
}
function getActiveTagsBySession(db, sessionId) {
  const rows = getActiveTagsBySessionStatement(db).all(sessionId).filter(isTagRow);
  return rows.map(toTagEntry);
}
function getTagsForPendingOperations(db, sessionId, pendingTagNumbers, protectedCount, recentToolWindow) {
  const byNumber = new Map;
  for (const tag of getTagsByNumbers(db, sessionId, pendingTagNumbers)) {
    byNumber.set(tag.tagNumber, tag);
  }
  const addRows = (sql, limit) => {
    if (limit <= 0)
      return;
    const rows = db.prepare(sql).all(sessionId, limit).filter(isTagRow);
    for (const row of rows) {
      const tag = toTagEntry(row);
      byNumber.set(tag.tagNumber, tag);
    }
  };
  addRows(`SELECT ${TAG_SELECT_COLUMNS} FROM tags
         WHERE session_id = ? AND status = 'active'
         ORDER BY tag_number DESC, id DESC LIMIT ?`, protectedCount);
  addRows(`SELECT ${TAG_SELECT_COLUMNS} FROM tags
         WHERE session_id = ? AND type = 'tool'
         ORDER BY tag_number DESC, id DESC LIMIT ?`, recentToolWindow);
  return [...byNumber.values()].sort((left, right) => left.tagNumber - right.tagNumber);
}
function getTagsByNumbers(db, sessionId, tagNumbers) {
  if (tagNumbers.length === 0)
    return [];
  if (tagNumbers.length > 900) {
    const all = [];
    for (let i = 0;i < tagNumbers.length; i += 900) {
      all.push(...getTagsByNumbers(db, sessionId, tagNumbers.slice(i, i + 900)));
    }
    return all;
  }
  const placeholders = tagNumbers.map(() => "?").join(",");
  const rows = db.prepare(`SELECT ${TAG_SELECT_COLUMNS} FROM tags WHERE session_id = ? AND tag_number IN (${placeholders}) ORDER BY tag_number ASC, id ASC`).all(sessionId, ...tagNumbers).filter(isTagRow);
  return rows.map(toTagEntry);
}
function getDroppedTagsByNumbers(db, sessionId, tagNumbers) {
  if (tagNumbers.length === 0)
    return [];
  if (tagNumbers.length > 900) {
    const all = [];
    for (let i = 0;i < tagNumbers.length; i += 900) {
      all.push(...getDroppedTagsByNumbers(db, sessionId, tagNumbers.slice(i, i + 900)));
    }
    return all;
  }
  const placeholders = tagNumbers.map(() => "?").join(",");
  const rows = db.prepare(`SELECT ${TAG_SELECT_COLUMNS} FROM tags WHERE session_id = ? AND status = 'dropped' AND tag_number IN (${placeholders}) ORDER BY tag_number ASC, id ASC`).all(sessionId, ...tagNumbers).filter(isTagRow);
  return rows.map(toTagEntry);
}
function getMaxDroppedTagNumber(db, sessionId) {
  const row = getMaxDroppedTagNumberStatement(db).get(sessionId);
  return isMaxTagNumberRow(row) ? row.max_tag_number : 0;
}
var getToolTagNumberByOwnerStatements = new WeakMap;
var getNullOwnerToolTagStatements = new WeakMap;
var adoptNullOwnerToolTagStatements = new WeakMap;
var getToolOwnerByTagIdStatements = new WeakMap;
var deleteToolTagsByOwnerStatements = new WeakMap;
function getGetToolTagNumberByOwnerStatement(db) {
  let stmt = getToolTagNumberByOwnerStatements.get(db);
  if (!stmt) {
    stmt = db.prepare(`SELECT tag_number FROM tags
             WHERE session_id = ? AND message_id = ?
               AND type = 'tool' AND tool_owner_message_id = ?
             LIMIT 1`);
    getToolTagNumberByOwnerStatements.set(db, stmt);
  }
  return stmt;
}
function getToolTagNumberByOwner(db, sessionId, callId, ownerMsgId) {
  const row = getGetToolTagNumberByOwnerStatement(db).get(sessionId, callId, ownerMsgId);
  return isTagNumberRow(row) ? row.tag_number : null;
}
function isNullOwnerToolTagRow(row) {
  if (row === null || typeof row !== "object")
    return false;
  const r = row;
  return typeof r.id === "number" && typeof r.tag_number === "number";
}
function getGetNullOwnerToolTagStatement(db) {
  let stmt = getNullOwnerToolTagStatements.get(db);
  if (!stmt) {
    stmt = db.prepare(`SELECT id, tag_number FROM tags
             WHERE session_id = ? AND message_id = ?
               AND type = 'tool' AND tool_owner_message_id IS NULL
             ORDER BY tag_number ASC
             LIMIT 1`);
    getNullOwnerToolTagStatements.set(db, stmt);
  }
  return stmt;
}
function getNullOwnerToolTag(db, sessionId, callId) {
  const row = getGetNullOwnerToolTagStatement(db).get(sessionId, callId);
  if (!isNullOwnerToolTagRow(row))
    return null;
  return { id: row.id, tagNumber: row.tag_number };
}
function getAdoptNullOwnerToolTagStatement(db) {
  let stmt = adoptNullOwnerToolTagStatements.get(db);
  if (!stmt) {
    stmt = db.prepare(`UPDATE tags
             SET tool_owner_message_id = ?
             WHERE id = ? AND tool_owner_message_id IS NULL`);
    adoptNullOwnerToolTagStatements.set(db, stmt);
  }
  return stmt;
}
function getToolOwnerByTagIdStatement(db) {
  let stmt = getToolOwnerByTagIdStatements.get(db);
  if (!stmt) {
    stmt = db.prepare("SELECT tool_owner_message_id FROM tags WHERE id = ?");
    getToolOwnerByTagIdStatements.set(db, stmt);
  }
  return stmt;
}
function adoptNullOwnerToolTag(db, rowId, ownerMsgId) {
  return db.transaction(() => {
    const before = getToolOwnerByTagIdStatement(db).get(rowId);
    if (!before || before.tool_owner_message_id !== null)
      return false;
    getAdoptNullOwnerToolTagStatement(db).run(ownerMsgId, rowId);
    const after = getToolOwnerByTagIdStatement(db).get(rowId);
    return after?.tool_owner_message_id === ownerMsgId;
  }).immediate();
}
function getCandidateToolOwners(db, sessionId, callId) {
  const rows = db.prepare(`SELECT DISTINCT tool_owner_message_id
             FROM tags
             WHERE session_id = ?
               AND message_id = ?
               AND type = 'tool'
               AND tool_owner_message_id IS NOT NULL`).all(sessionId, callId);
  return rows.map((r) => r.tool_owner_message_id);
}
function pickNearestPriorOwner(candidates, currentMessageId, times) {
  const currentTime = times.get(currentMessageId);
  if (typeof currentTime !== "number")
    return null;
  let best = null;
  for (const id of candidates) {
    const t = times.get(id);
    if (typeof t !== "number")
      continue;
    if (t > currentTime)
      continue;
    if (t === currentTime && id >= currentMessageId)
      continue;
    if (best === null || t > best.time || t === best.time && id > best.id) {
      best = { id, time: t };
    }
  }
  return best?.id ?? null;
}

// ../plugin/src/hooks/magic-context/host-served-rows.ts
var HOST_UNSERVED_ROW = "hostUnservedRow";
function markHostUnservedRow(target) {
  Object.defineProperty(target, HOST_UNSERVED_ROW, {
    value: true,
    enumerable: false,
    configurable: true
  });
  return target;
}
function isHostUnservedRow(value) {
  return typeof value === "object" && value !== null && value[HOST_UNSERVED_ROW] === true;
}
function retreatPastHostUnservedRows(messages, exclusiveEnd, floor) {
  if (!messages.some(isHostUnservedRow))
    return exclusiveEnd;
  const byOrdinal = new Map(messages.map((message) => [message.ordinal, message]));
  let end = exclusiveEnd;
  while (end - 1 >= floor && isHostUnservedRow(byOrdinal.get(end - 1)))
    end -= 1;
  return end;
}

// ../plugin/src/shared/opencode-db-path.ts
import { existsSync as existsSync2, readdirSync, statSync as statSync2 } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { isAbsolute, join as join2 } from "node:path";
var cachedResolution = null;
var lastReadFailure = null;
var claimedDiagnostics = new Set;
function openCodeDataDir(env = process.env, dataHome) {
  return join2(dataHome ?? env.XDG_DATA_HOME ?? join2(homedir2(), ".local", "share"), "opencode");
}
function environmentKey(dataDir, hostGeneration, channel, env) {
  return [
    hostGeneration,
    dataDir,
    env.OPENCODE_DB ?? "",
    env.OPENCODE_DISABLE_CHANNEL_DB ?? "",
    channel ?? env.OPENCODE_CHANNEL ?? ""
  ].join("\x00");
}
function channelPath(dataDir, channel) {
  return ["latest", "beta", "prod"].includes(channel) ? join2(dataDir, "opencode.db") : join2(dataDir, `opencode-${channel}.db`);
}
function discoveredCandidateNames(dataDir) {
  const names = ["opencode.db", "opencode-local.db", "opencode-dev.db"];
  try {
    const discovered = readdirSync(dataDir, { withFileTypes: true }).filter((entry) => /^opencode-.+\.db$/.test(entry.name) && !names.includes(entry.name)).map((entry) => entry.name).sort();
    names.push(...discovered);
  } catch {}
  return names;
}
function discoverOpenCodeDb(dataDir) {
  const candidates = discoveredCandidateNames(dataDir).map((name, order) => {
    const path = join2(dataDir, name);
    try {
      const metadata = statSync2(path);
      return metadata.isFile() ? { path, order, mtimeMs: metadata.mtimeMs } : null;
    } catch {
      return null;
    }
  });
  const existing = candidates.filter((candidate) => candidate !== null).sort((left, right) => right.mtimeMs - left.mtimeMs || left.order - right.order)[0];
  if (!existing) {
    return { path: join2(dataDir, "opencode.db"), source: "default", channel: null };
  }
  const name = existing.path.slice(dataDir.length + 1);
  const channel = name === "opencode.db" ? null : name.slice("opencode-".length, -".db".length) || null;
  return { path: existing.path, source: "discovered", channel };
}
function resolveV1Fresh(dataDir, env = process.env) {
  const explicit = env.OPENCODE_DB;
  if (explicit !== undefined && explicit.length > 0) {
    if (explicit === ":memory:") {
      return { path: explicit, source: "OPENCODE_DB", channel: null };
    }
    return {
      path: isAbsolute(explicit) ? explicit : join2(dataDir, explicit),
      source: "OPENCODE_DB",
      channel: null
    };
  }
  const disableChannelDb = env.OPENCODE_DISABLE_CHANNEL_DB;
  if (disableChannelDb === "1" || disableChannelDb === "true") {
    return { path: join2(dataDir, "opencode.db"), source: "default", channel: null };
  }
  const channel = env.OPENCODE_CHANNEL;
  if (channel !== undefined && channel.length > 0) {
    return { path: channelPath(dataDir, channel), source: "channel", channel };
  }
  return discoverOpenCodeDb(dataDir);
}
function sourceOpenCodeDatabaseFilename(hostGeneration, channel, env = process.env) {
  if (hostGeneration === "v1") {
    const explicit = env.OPENCODE_DB;
    if (explicit !== undefined && explicit.length > 0)
      return explicit;
    if (env.OPENCODE_DISABLE_CHANNEL_DB === "1" || env.OPENCODE_DISABLE_CHANNEL_DB === "true") {
      return "opencode.db";
    }
    return ["latest", "beta", "prod"].includes(channel) ? "opencode.db" : `opencode-${channel}.db`;
  }
  return env.OPENCODE_DB ?? (["latest", "dev", "beta", "next", "prod"].includes(channel) || env.OPENCODE_DISABLE_CHANNEL_DB === "1" || env.OPENCODE_DISABLE_CHANNEL_DB === "true" ? "opencode.db" : `opencode-${channel.replace(/[^a-zA-Z0-9._-]/g, "")}.db`);
}
function resolveV2Fresh(dataDir, channel, env) {
  const filename = sourceOpenCodeDatabaseFilename("v2", channel, env);
  const explicit = env.OPENCODE_DB !== undefined;
  return {
    path: filename === ":memory:" ? filename : join2(dataDir, filename),
    source: explicit ? "OPENCODE_DB" : env.OPENCODE_CHANNEL ? "channel" : "default",
    channel: explicit ? null : channel
  };
}
function resolveOpenCodeDbPath(hostGeneration = "v1", options = {}) {
  const env = options.env ?? process.env;
  const dataDir = openCodeDataDir(env, options.dataHome);
  const channel = options.channel ?? env.OPENCODE_CHANNEL;
  const key = environmentKey(dataDir, hostGeneration, channel, env);
  if (cachedResolution?.key === key && (!cachedResolution.existed || existsSync2(cachedResolution.resolution.path))) {
    if (cachedResolution.existed)
      return cachedResolution.resolution;
  }
  const resolution = hostGeneration === "v2" ? resolveV2Fresh(dataDir, channel ?? "latest", env) : resolveV1Fresh(dataDir, env);
  cachedResolution = {
    key,
    resolution,
    existed: resolution.path !== ":memory:" && existsSync2(resolution.path)
  };
  return resolution;
}
function schemaTableNames(db, schema = "main") {
  const rows = db.prepare(`SELECT name FROM ${schema}.sqlite_master WHERE type = 'table' AND name IN ('message', 'part', 'session', 'project', 'session_message', 'session_v2')`).all();
  return new Set(rows.flatMap((row) => typeof row.name === "string" ? [row.name] : []));
}
function hasV1MessageTables(db, schema = "main") {
  const tables = schemaTableNames(db, schema);
  return tables.has("message") && tables.has("part");
}
function detectOpenCodeStoreGeneration(db, schema = "main") {
  const tables = schemaTableNames(db, schema);
  const hasV1Messages = tables.has("message") && tables.has("part");
  if (hasV1Messages)
    return "v1";
  if (tables.has("session_message"))
    return "v2";
  if (tables.has("session") || tables.has("project"))
    return "v1";
  return "unknown";
}
function hasMigratedV2Schema(tables) {
  return tables.has("session_message") && tables.has("session_v2");
}
function isOpenCodeV2Store(db, schema = "main") {
  return detectOpenCodeStoreGeneration(db, schema) === "v2" || hasMigratedV2Schema(schemaTableNames(db, schema));
}
function assertOpenCodeStoreGeneration(db, expected, path, schema = "main") {
  const actual = detectOpenCodeStoreGeneration(db, schema);
  if (actual === expected)
    return;
  if (expected === "v2" && isOpenCodeV2Store(db, schema))
    return;
  if (actual === "unknown")
    return;
  throw new Error(`OpenCode store generation mismatch at ${path}: expected ${expected}, found ${actual}; refusing generation-specific database access`);
}
function openCodeDbPathExists(resolution = resolveOpenCodeDbPath()) {
  return resolution.path !== ":memory:" && existsSync2(resolution.path);
}
function getOpenCodeDbProbeDescriptions(resolution = resolveOpenCodeDbPath()) {
  if (resolution.source === "OPENCODE_DB")
    return [resolution.path];
  if (resolution.source === "channel" || process.env.OPENCODE_DISABLE_CHANNEL_DB === "1" || process.env.OPENCODE_DISABLE_CHANNEL_DB === "true") {
    return [resolution.path];
  }
  const dataDir = openCodeDataDir();
  return [
    join2(dataDir, "opencode.db"),
    join2(dataDir, "opencode-local.db"),
    join2(dataDir, "opencode-dev.db"),
    join2(dataDir, "opencode-<channel>.db")
  ];
}
function recordOpenCodeDbReadFailure(resolution, error) {
  const message = error instanceof Error ? error.message : String(error);
  lastReadFailure = { ...resolution, message };
  return lastReadFailure;
}
function clearOpenCodeDbReadFailure(path) {
  if (path === undefined || lastReadFailure?.path === path)
    lastReadFailure = null;
}
function claimOpenCodeDbDiagnosticOnce(surface, resolution) {
  const key = `${surface}\x00${resolution.path}\x00${resolution.source}`;
  if (claimedDiagnostics.has(key))
    return false;
  claimedDiagnostics.add(key);
  return true;
}

// ../plugin/src/shared/sqlite.ts
var reportSlowPrivilegedWrite;
function registerSlowWriteReporter(reporter) {
  reportSlowPrivilegedWrite = reporter;
}
function detectSqliteRuntime() {
  const hasBunVersion = typeof process !== "undefined" && typeof process.versions?.bun === "string";
  const hasBunGlobal = typeof globalThis !== "undefined" && typeof globalThis.Bun !== "undefined";
  return hasBunVersion || hasBunGlobal ? "Bun" : "Node.js";
}
var bunSpec = "bun:" + "sqlite";
var nodeSpec = "node:" + "sqlite";
async function importSqliteModule(specifier) {
  return await import(specifier);
}
function isModuleNotFoundError(error, specifier) {
  const candidate = error;
  const code = typeof candidate?.code === "string" ? candidate.code : "";
  const name = typeof candidate?.name === "string" ? candidate.name : "";
  const message = error instanceof Error ? error.message : String(error ?? "");
  const details = `${code} ${name} ${message}`.toLowerCase();
  const mentionsSpecifier = details.includes(specifier.toLowerCase());
  if (!mentionsSpecifier)
    return false;
  return code === "ERR_MODULE_NOT_FOUND" || code === "ERR_UNKNOWN_BUILTIN_MODULE" || code === "MODULE_NOT_FOUND" || name === "ResolveMessage" || details.includes("module not found") || details.includes("cannot find module") || details.includes("cannot find package") || details.includes("no such built-in module");
}

class SqliteRuntimeUnavailableError extends Error {
  runtime;
  specifier;
  constructor(runtime, specifier, cause) {
    const requirement = specifier === nodeSpec ? "Requires Node.js >= 24, or Bun with bun:sqlite — this Bun build lacks node:sqlite." : "Requires Bun with bun:sqlite, or Node.js >= 24 — this Bun build lacks bun:sqlite.";
    super(`Magic Context detected ${runtime}, but could not load ${specifier}. ${requirement}`, { cause });
    this.name = "SqliteRuntimeUnavailableError";
    this.runtime = runtime;
    this.specifier = specifier;
  }
}
async function loadSqliteModule(runtime = detectSqliteRuntime(), importer = importSqliteModule) {
  const specifier = runtime === "Bun" ? bunSpec : nodeSpec;
  try {
    return await importer(specifier);
  } catch (error) {
    if (isModuleNotFoundError(error, specifier)) {
      throw new SqliteRuntimeUnavailableError(runtime, specifier, error);
    }
    throw error;
  }
}
var detectedRuntime = detectSqliteRuntime();
var isBun = detectedRuntime === "Bun";
var sqliteModule = await loadSqliteModule(detectedRuntime);
var DatabaseImpl = isBun ? sqliteModule.Database : buildNodeSqliteDatabaseClass(sqliteModule.DatabaseSync);
var trackedSqliteConnections = new Map;
var nextSqliteConnectionSequence = 1;
function trackSqliteConnection(db, filename, options) {
  const originalClose = db.close.bind(db);
  const sequence = nextSqliteConnectionSequence++;
  const metadata = {
    sequence,
    filename: typeof filename === "string" ? filename : Buffer.isBuffer(filename) ? "<buffer>" : ":memory:",
    readonly: Boolean(options) && typeof options === "object" && (options.readonly === true || options.readOnly === true)
  };
  Object.defineProperty(db, "close", {
    configurable: true,
    value: (...args) => {
      try {
        return originalClose(...args);
      } finally {
        trackedSqliteConnections.delete(sequence);
      }
    }
  });
  trackedSqliteConnections.set(sequence, {
    ...metadata,
    reference: new WeakRef(db)
  });
  return db;
}
var TrackedDatabase = new Proxy(DatabaseImpl, {
  construct(target, args) {
    const db = Reflect.construct(target, args, target);
    return trackSqliteConnection(db, args[0], args[1]);
  }
});
function buildNodeSqliteDatabaseClass(DatabaseSync) {
  const SAVEPOINT = "mc_tx_sp";

  class NodeSqliteDatabase extends DatabaseSync {
    constructor(filename, options) {
      const translated = { ...options };
      if (options && "readonly" in options) {
        translated.readOnly = options.readonly;
        delete translated.readonly;
      }
      super(typeof filename === "string" ? filename : ":memory:", translated);
    }
    prepare(sql) {
      const stmt = super.prepare(sql);
      for (const method of ["run", "get", "all"]) {
        const original = stmt[method].bind(stmt);
        stmt[method] = (...args) => args.length === 1 && Array.isArray(args[0]) ? original(...args[0]) : original(...args);
      }
      return stmt;
    }
    transaction(fn) {
      const self = this;
      const execute = (mode, receiver, args) => {
        const nested = self.isTransaction === true;
        self.exec(nested ? `SAVEPOINT ${SAVEPOINT}` : `BEGIN${mode ? ` ${mode}` : ""}`);
        try {
          const result = fn.apply(receiver, args);
          self.exec(nested ? `RELEASE ${SAVEPOINT}` : "COMMIT");
          return result;
        } catch (error) {
          if (nested) {
            self.exec(`ROLLBACK TO ${SAVEPOINT}`);
            self.exec(`RELEASE ${SAVEPOINT}`);
          } else {
            self.exec("ROLLBACK");
          }
          throw error;
        }
      };
      const wrapped = function(...args) {
        return execute("", this, args);
      };
      wrapped.default = function(...args) {
        return execute("", this, args);
      };
      wrapped.deferred = function(...args) {
        return execute("DEFERRED", this, args);
      };
      wrapped.immediate = function(...args) {
        return execute("IMMEDIATE", this, args);
      };
      wrapped.exclusive = function(...args) {
        return execute("EXCLUSIVE", this, args);
      };
      return wrapped;
    }
  }
  return NodeSqliteDatabase;
}
var Database = TrackedDatabase;
var privilegeDepth = new WeakMap;
function isInTransaction(db) {
  const candidate = db;
  return candidate.inTransaction === true || candidate.isTransaction === true;
}
function withPrivilegedWriter(db, operation) {
  const previousDepth = privilegeDepth.get(db) ?? 0;
  const nested = isInTransaction(db);
  const savepoint = "mc_privilege_scope";
  const transactionStartedAt = nested ? undefined : performance.now();
  if (nested) {
    db.exec(`SAVEPOINT ${savepoint}`);
  } else {
    db.exec("BEGIN IMMEDIATE");
  }
  privilegeDepth.set(db, previousDepth + 1);
  try {
    db.prepare("INSERT INTO context_privilege_state(id, enabled) VALUES (1, 1) ON CONFLICT(id) DO UPDATE SET enabled = 1").run();
    const result = operation();
    if (previousDepth === 0) {
      db.prepare("UPDATE context_privilege_state SET enabled = 0 WHERE id = 1").run();
    }
    if (nested) {
      db.exec(`RELEASE ${savepoint}`);
    } else {
      db.exec("COMMIT");
      if (transactionStartedAt !== undefined) {
        reportSlowPrivilegedWrite?.("privileged_writer", transactionStartedAt);
      }
    }
    if (previousDepth > 0)
      privilegeDepth.set(db, previousDepth);
    else
      privilegeDepth.delete(db);
    return result;
  } catch (error) {
    try {
      if (nested) {
        db.exec(`ROLLBACK TO ${savepoint}`);
        db.exec(`RELEASE ${savepoint}`);
      } else {
        db.exec("ROLLBACK");
      }
    } finally {
      if (previousDepth > 0)
        privilegeDepth.set(db, previousDepth);
      else
        privilegeDepth.delete(db);
    }
    throw error;
  }
}

// ../plugin/src/shared/sqlite-helpers.ts
function closeQuietly(db) {
  if (!db)
    return;
  try {
    db.close();
  } catch {}
}

// ../plugin/src/hooks/magic-context/read-session-db.ts
function openCodeDbExists() {
  return openCodeDbPathExists(resolveOpenCodeDbPath());
}
var cachedReadOnlyDb = null;
function closeCachedReadOnlyDb() {
  if (!cachedReadOnlyDb) {
    return;
  }
  try {
    closeQuietly(cachedReadOnlyDb.db);
  } catch (error) {
    log("[magic-context] failed to close cached OpenCode read-only DB:", error);
  } finally {
    cachedReadOnlyDb = null;
  }
}
function getReadOnlySessionDb() {
  const resolution = resolveOpenCodeDbPath();
  const dbPath = resolution.path;
  if (!openCodeDbPathExists(resolution)) {
    throw new Error(`OpenCode session database is unavailable at ${dbPath} (source=${resolution.source})`);
  }
  if (cachedReadOnlyDb?.path === dbPath) {
    return cachedReadOnlyDb.db;
  }
  closeCachedReadOnlyDb();
  const db = new Database(dbPath, { readonly: true });
  try {
    assertOpenCodeStoreGeneration(db, "v1", dbPath);
  } catch (error) {
    closeQuietly(db);
    throw error;
  }
  cachedReadOnlyDb = { path: dbPath, db };
  clearOpenCodeDbReadFailure();
  return db;
}
function withReadOnlySessionDb(fn) {
  return fn(getReadOnlySessionDb());
}
function getRawSessionMessageCountFromDb(db, sessionId) {
  const row = db.prepare(`SELECT COUNT(*) as count FROM message WHERE session_id = ?
             AND NOT (COALESCE(json_extract(data, '$.summary'), 0) = 1
                      AND COALESCE(json_extract(data, '$.finish'), '') = 'stop')`).get(sessionId);
  return typeof row?.count === "number" ? row.count : 0;
}
var trackedSessions = new Map;
var pendingParts = new Map;
var probeLogObserverForTests;
function logProbeFailureOnce(resolution, error) {
  const failure = recordOpenCodeDbReadFailure(resolution, error);
  if (!claimOpenCodeDbDiagnosticOnce("session-state-probe", resolution))
    return;
  const message = `[magic-context] OpenCode DB probe failed: path=${resolution.path} source=${resolution.source} cause=${failure.message}`;
  probeLogObserverForTests?.(message);
  log(message);
}
function getMessageTimesFromOpenCodeDb(sessionId, messageIds) {
  const result = new Map;
  if (messageIds.length === 0)
    return result;
  try {
    withReadOnlySessionDb((db) => {
      const placeholders = messageIds.map(() => "?").join(",");
      const rows = db.prepare(`SELECT id, time_created FROM message WHERE session_id = ? AND id IN (${placeholders})`).all(sessionId, ...messageIds);
      for (const row of rows) {
        if (typeof row.id === "string" && typeof row.time_created === "number") {
          result.set(row.id, row.time_created);
        }
      }
    });
  } catch (error) {
    logProbeFailureOnce(resolveOpenCodeDbPath(), error);
  }
  return result;
}

// ../plugin/src/hooks/magic-context/read-session-raw.ts
var RAW_MESSAGE_PARTS_BY_ID_SQL = "SELECT message_id, data, time_updated FROM part WHERE +session_id = ? AND likelihood(message_id = ?, 0.000001) ORDER BY time_created ASC, id ASC";
function isRawMessageRow(row) {
  if (row === null || typeof row !== "object")
    return false;
  const candidate = row;
  return typeof candidate.id === "string" && typeof candidate.data === "string";
}
function isRawPartRow(row) {
  if (row === null || typeof row !== "object")
    return false;
  const candidate = row;
  return typeof candidate.message_id === "string" && typeof candidate.data === "string";
}
function parseJsonRecord(value) {
  try {
    const parsed = JSON.parse(value);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
function isRawCompactionSummaryInfo(info) {
  if (info === null || typeof info !== "object" || Array.isArray(info))
    return false;
  const candidate = info;
  return candidate.summary === true && candidate.finish === "stop";
}
function parseJsonUnknown(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
function attachRawPartVersion(value, timeUpdated) {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return value;
  if (typeof timeUpdated !== "number")
    return value;
  try {
    Object.defineProperty(value, "__magicContextPartUpdatedAt", {
      value: timeUpdated,
      enumerable: false,
      configurable: true
    });
  } catch {}
  return value;
}
function readRawSessionMessagesFromDb(db, sessionId) {
  const messageRows = db.prepare("SELECT id, data, time_created, time_updated FROM message WHERE session_id = ? ORDER BY time_created ASC, id ASC").all(sessionId).filter(isRawMessageRow);
  const partsByMessageId = new Map;
  const partMessageBatchSize = 128;
  for (let offset = 0;offset < messageRows.length; offset += partMessageBatchSize) {
    const messageIds = messageRows.slice(offset, offset + partMessageBatchSize).map((row) => row.id);
    if (messageIds.length === 0)
      continue;
    const placeholders = messageIds.map(() => "?").join(", ");
    const partRows = db.prepare(`SELECT message_id, data, time_updated
                 FROM part
                 WHERE +session_id = ?
                   AND likelihood(message_id IN (${placeholders}), 0.000001)
                 ORDER BY message_id ASC, time_created ASC, id ASC`).all(sessionId, ...messageIds).filter(isRawPartRow);
    for (const part of partRows) {
      const list = partsByMessageId.get(part.message_id) ?? [];
      list.push(attachRawPartVersion(parseJsonUnknown(part.data), part.time_updated));
      partsByMessageId.set(part.message_id, list);
    }
  }
  const filtered = messageRows.filter((row) => !isRawCompactionSummaryInfo(parseJsonRecord(row.data)));
  return filtered.flatMap((row, index) => {
    const info = parseJsonRecord(row.data);
    if (!info)
      return [];
    const role = typeof info.role === "string" ? info.role : "unknown";
    return {
      ordinal: index + 1,
      id: row.id,
      role,
      parts: partsByMessageId.get(row.id) ?? [],
      createdAt: row.time_created ?? null,
      version: row.time_updated ?? null
    };
  });
}
function readRawSessionMessagePageFromDb(db, sessionId, afterOrdinal, limit, finalWatermark = Number.MAX_SAFE_INTEGER) {
  const remaining = Math.max(0, Math.floor(finalWatermark) - Math.floor(afterOrdinal));
  const pageSize = Math.min(Math.max(1, Math.floor(limit)), remaining);
  if (pageSize === 0)
    return [];
  const messageRows = db.prepare(`SELECT id, data, time_created, time_updated
             FROM message
             WHERE session_id = ?
               AND NOT (
                   CASE WHEN json_valid(data) = 1
                        THEN COALESCE(json_extract(data, '$.summary'), 0)
                        ELSE 0 END = 1
                   AND CASE WHEN json_valid(data) = 1
                            THEN COALESCE(json_extract(data, '$.finish'), '')
                            ELSE '' END = 'stop'
               )
             ORDER BY time_created ASC, id ASC
             LIMIT ? OFFSET ?`).all(sessionId, pageSize, Math.max(0, Math.floor(afterOrdinal))).filter(isRawMessageRow).map((row, index) => ({
    ...row,
    ordinal: Math.floor(afterOrdinal) + index + 1
  }));
  if (messageRows.length === 0)
    return [];
  const placeholders = messageRows.map(() => "?").join(", ");
  const partRows = db.prepare(`SELECT message_id, data, time_updated
             FROM part
             WHERE +session_id = ?
               AND likelihood(message_id IN (${placeholders}), 0.000001)
             ORDER BY message_id ASC, time_created ASC, id ASC`).all(sessionId, ...messageRows.map((row) => row.id)).filter(isRawPartRow);
  const partsByMessageId = new Map;
  for (const part of partRows) {
    const list = partsByMessageId.get(part.message_id) ?? [];
    list.push(attachRawPartVersion(parseJsonUnknown(part.data), part.time_updated));
    partsByMessageId.set(part.message_id, list);
  }
  return messageRows.map((row) => {
    const info = parseJsonRecord(row.data);
    return {
      ordinal: row.ordinal,
      id: row.id,
      role: typeof info?.role === "string" ? info.role : "unknown",
      parts: partsByMessageId.get(row.id) ?? [],
      createdAt: row.time_created ?? null,
      version: row.time_updated ?? null
    };
  });
}
function countRawSessionMessageOrdinalsFromDb(db, sessionId) {
  const row = db.prepare(`SELECT COUNT(*) AS count
             FROM message
             WHERE session_id = ?
               AND NOT (
                   CASE WHEN json_valid(data) = 1
                        THEN COALESCE(json_extract(data, '$.summary'), 0)
                        ELSE 0 END = 1
                   AND CASE WHEN json_valid(data) = 1
                            THEN COALESCE(json_extract(data, '$.finish'), '')
                            ELSE '' END = 'stop'
               )`).get(sessionId);
  return typeof row?.count === "number" ? row.count : 0;
}
function readRawSessionMessageIdOrdinalsFromDb(db, sessionId) {
  const messageRows = db.prepare("SELECT id, data FROM message WHERE session_id = ? ORDER BY time_created ASC, id ASC").all(sessionId).filter(isRawMessageRow);
  const ordinalById = new Map;
  let ordinal = 0;
  for (const row of messageRows) {
    const info = parseJsonRecord(row.data);
    if (isRawCompactionSummaryInfo(info))
      continue;
    ordinal += 1;
    if (info)
      ordinalById.set(row.id, ordinal);
  }
  return ordinalById;
}
function isAnchorRow(row) {
  return row !== null && typeof row === "object" && typeof row.time_created === "number" && typeof row.id === "string";
}
function readRawSessionTailFromDb(db, sessionId, baseOrdinal, anchorMessageId) {
  const anchorRow = db.prepare("SELECT time_created, id, data FROM message WHERE id = ? AND session_id = ?").get(anchorMessageId, sessionId);
  if (!isAnchorRow(anchorRow))
    return null;
  const anchorInfo = parseJsonRecord(anchorRow.data ?? "");
  if (anchorInfo?.summary === true && anchorInfo?.finish === "stop")
    return null;
  const messageRows = db.prepare(`SELECT id, data, time_created, time_updated FROM message
             WHERE session_id = ?
               AND (time_created > ? OR (time_created = ? AND id >= ?))
             ORDER BY time_created ASC, id ASC`).all(sessionId, anchorRow.time_created, anchorRow.time_created, anchorRow.id).filter(isRawMessageRow);
  const filtered = messageRows.filter((row) => {
    const info = parseJsonRecord(row.data);
    return !(info?.summary === true && info?.finish === "stop");
  });
  const ids = filtered.map((row) => row.id);
  const partsByMessageId = new Map;
  if (ids.length > 0) {
    const CHUNK = 800;
    for (let i = 0;i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const placeholders = slice.map(() => "?").join(",");
      const partRows = db.prepare(`SELECT message_id, data, time_updated FROM part WHERE +session_id = ? AND likelihood(message_id IN (${placeholders}), 0.000001) ORDER BY time_created ASC, id ASC`).all(sessionId, ...slice).filter(isRawPartRow);
      for (const part of partRows) {
        const list = partsByMessageId.get(part.message_id) ?? [];
        list.push(attachRawPartVersion(parseJsonUnknown(part.data), part.time_updated));
        partsByMessageId.set(part.message_id, list);
      }
    }
  }
  const messages = [];
  let ord = baseOrdinal;
  for (const row of filtered) {
    const info = parseJsonRecord(row.data);
    if (!info) {
      ord += 1;
      continue;
    }
    messages.push({
      ordinal: ord,
      id: row.id,
      role: typeof info.role === "string" ? info.role : "unknown",
      parts: partsByMessageId.get(row.id) ?? [],
      createdAt: row.time_created ?? null,
      version: row.time_updated ?? null
    });
    ord += 1;
  }
  return { messages, absoluteMessageCount: Math.max(0, ord - 1) };
}
function readRawSessionMessageByIdFromDb(db, sessionId, messageId) {
  const row = db.prepare("SELECT id, data, time_created, time_updated FROM message WHERE session_id = ? AND id = ?").get(sessionId, messageId);
  if (!row || !isRawMessageRow(row) || typeof row.time_created !== "number") {
    return null;
  }
  const info = parseJsonRecord(row.data);
  if (!info || isRawCompactionSummaryInfo(info)) {
    return null;
  }
  const ordinalRow = db.prepare(`SELECT COUNT(*) AS ordinal FROM message
             WHERE session_id = ?
               AND NOT (COALESCE(json_extract(data, '$.summary'), 0) = 1
                        AND COALESCE(json_extract(data, '$.finish'), '') = 'stop')
               AND (time_created < ? OR (time_created = ? AND id <= ?))`).get(sessionId, row.time_created, row.time_created, messageId);
  const ordinal = typeof ordinalRow?.ordinal === "number" ? ordinalRow.ordinal : 0;
  if (ordinal <= 0) {
    return null;
  }
  const partRows = db.prepare(RAW_MESSAGE_PARTS_BY_ID_SQL).all(sessionId, messageId).filter(isRawPartRow);
  const role = typeof info.role === "string" ? info.role : "unknown";
  return {
    ordinal,
    id: row.id,
    role,
    parts: partRows.map((part) => attachRawPartVersion(parseJsonUnknown(part.data), part.time_updated)),
    createdAt: row.time_created,
    version: row.time_updated ?? null
  };
}

// ../plugin/src/hooks/magic-context/read-session-true-raw-tokens.ts
function completedToolArcCrossesBoundary(invOrdinal, resOrdinal, boundary) {
  return invOrdinal < boundary && boundary <= resOrdinal;
}
var MAX_MESSAGE_CACHE_ENTRIES = 1e5;
var MAX_MESSAGE_CACHE_KEY_BYTES = 64 * 1024 * 1024;
var FNV1A_32_OFFSET = 2166136261;
var FNV1A_32_PRIME = 16777619;
var messageEstimateCache = new Map;
var messageEstimateCacheBytes = 0;
var EMPTY_BREAKDOWN = {
  text: 0,
  reasoning: 0,
  toolInput: 0,
  toolOutput: 0,
  image: 0,
  other: 0,
  total: 0
};
function addBreakdown(target, kind, value) {
  if (kind === "total")
    return;
  const safeValue = Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
  target[kind] += safeValue;
  target.total += safeValue;
}
function estimateStructured(value) {
  if (typeof value === "string")
    return estimateTokens(value);
  if (value === undefined || value === null)
    return 0;
  return estimateTokens(stableStringify(value));
}
function firstStringField(record, fields) {
  for (const field of fields) {
    const value = record[field];
    if (typeof value === "string" && value.length > 0)
      return value;
  }
  return null;
}
function stringValue(value) {
  if (typeof value === "string")
    return value;
  if (value === undefined || value === null)
    return "";
  return stableStringify(value);
}
function textFromToolResultContent(content) {
  if (typeof content === "string")
    return content;
  if (Array.isArray(content)) {
    const pieces = [];
    for (const entry of content) {
      if (typeof entry === "string") {
        pieces.push(entry);
      } else if (isRecord(entry)) {
        const text = firstStringField(entry, ["text", "content", "value"]);
        pieces.push(text ?? stableStringify(entry));
      } else if (entry !== null && entry !== undefined) {
        pieces.push(String(entry));
      }
    }
    return pieces.join(`
`);
  }
  return stringValue(content);
}
function looksImageLike(part) {
  const type = typeof part.type === "string" ? part.type.toLowerCase() : "";
  const mime = typeof part.mime === "string" ? part.mime.toLowerCase() : "";
  const mediaType = typeof part.mediaType === "string" ? part.mediaType.toLowerCase() : "";
  return type.includes("image") || mime.startsWith("image/") || mediaType.startsWith("image/") || part.image_url !== undefined || part.imageUrl !== undefined || part.image !== undefined;
}
function defaultImageTokenHeuristic(part) {
  if (isRecord(part)) {
    const width = part.width;
    const height = part.height;
    if (typeof width === "number" && typeof height === "number" && width > 0 && height > 0) {
      return Math.max(256, Math.min(4096, Math.ceil(width * height / 750)));
    }
  }
  return 1024;
}
function partType(part) {
  return typeof part.type === "string" ? part.type : "";
}
function hasOwn(record, key) {
  return Object.hasOwn(record, key);
}
function recursiveByteLength(value) {
  if (value === null || value === undefined)
    return 0;
  if (typeof value === "string")
    return value.length;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value).length;
  }
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + recursiveByteLength(item), value.length);
  }
  if (isRecord(value)) {
    let total = Object.keys(value).length;
    for (const [key, child] of Object.entries(value)) {
      total += key.length + recursiveByteLength(child);
    }
    return total;
  }
  return String(value).length;
}
function updateFnv1a32(hash, text) {
  let next = hash;
  for (let index = 0;index < text.length; index += 1) {
    next ^= text.charCodeAt(index);
    next = Math.imul(next, FNV1A_32_PRIME) >>> 0;
  }
  return next;
}
function contentStringsHash(fields) {
  let hash = FNV1A_32_OFFSET;
  for (const field of fields) {
    hash = updateFnv1a32(hash, `${field.length}:`);
    hash = updateFnv1a32(hash, field);
    hash = updateFnv1a32(hash, "\x00");
  }
  return hash.toString(16).padStart(8, "0");
}
function rawPartVersion(part) {
  return part.__magicContextPartUpdatedAt ?? part.updated_at ?? part.updatedAt ?? part.version ?? part.revision ?? "";
}
function callIdFromPart(part) {
  const direct = firstStringField(part, ["callID", "callId", "toolCallId", "tool_call_id", "id"]);
  if (direct)
    return direct;
  const state = isRecord(part.state) ? part.state : null;
  return state ? firstStringField(state, ["callID", "callId", "toolCallId", "tool_call_id", "id"]) ?? "" : "";
}
function toolSignalFromPart(part) {
  if (!isRecord(part))
    return null;
  const type = partType(part);
  const state = isRecord(part.state) ? part.state : null;
  const callId = callIdFromPart(part);
  if (!callId && type !== "tool")
    return null;
  if (type === "tool") {
    const hasInput = state !== null && hasOwn(state, "input");
    const outputKey = state ? hasOwn(state, "output") ? "output" : hasOwn(state, "error") ? "error" : hasOwn(state, "result") ? "result" : null : null;
    const hasOutput = outputKey !== null;
    const outputValue = outputKey && state ? state[outputKey] : undefined;
    const providerExecuted = part.providerExecuted === true;
    const openInvocation = !providerExecuted && !hasOutput;
    return {
      callId,
      hasInput: hasInput || openInvocation,
      hasOutput,
      inputText: hasInput && state ? stringValue(state.input) : "",
      outputText: hasOutput ? stringValue(outputValue) : ""
    };
  }
  if (type === "tool-invocation") {
    const args = part.args ?? part.input;
    return {
      callId,
      hasInput: args !== undefined,
      hasOutput: false,
      inputText: args !== undefined ? stringValue(args) : "",
      outputText: ""
    };
  }
  if (type === "tool_use") {
    const input = part.input;
    return {
      callId,
      hasInput: input !== undefined,
      hasOutput: false,
      inputText: input !== undefined ? stringValue(input) : "",
      outputText: ""
    };
  }
  if (type === "tool_result") {
    const content = part.content ?? part.output ?? part.result;
    return {
      callId,
      hasInput: false,
      hasOutput: content !== undefined,
      inputText: "",
      outputText: content !== undefined ? textFromToolResultContent(content) : ""
    };
  }
  return null;
}
function partCheapFingerprint(part) {
  if (!isRecord(part))
    return `${typeof part}:${recursiveByteLength(part)}`;
  const version = rawPartVersion(part);
  const type = typeof part.type === "string" ? part.type : "";
  return `${type}:${String(version)}:${recursiveByteLength(part)}`;
}
function messageCacheKey(message, options) {
  const namespace = "cacheNamespace" in options ? options.cacheNamespace : "estimate";
  const cheapFingerprint = message.parts.map(partCheapFingerprint).join("|");
  return [
    namespace,
    options.providerShapeVersion,
    message.id || `ordinal:${message.ordinal}`,
    message.role,
    message.parts.length,
    cheapFingerprint
  ].join("\x00");
}
function setCachedEstimate(key, breakdown) {
  const keyEstimateBytes = key.length * 2 + 64;
  const existing = messageEstimateCache.get(key);
  if (existing)
    messageEstimateCacheBytes -= existing.keyEstimateBytes;
  messageEstimateCache.set(key, { breakdown, keyEstimateBytes });
  messageEstimateCacheBytes += keyEstimateBytes;
  while (messageEstimateCache.size > MAX_MESSAGE_CACHE_ENTRIES || messageEstimateCacheBytes > MAX_MESSAGE_CACHE_KEY_BYTES) {
    const first = messageEstimateCache.keys().next().value;
    if (typeof first !== "string")
      break;
    const removed = messageEstimateCache.get(first);
    if (removed)
      messageEstimateCacheBytes -= removed.keyEstimateBytes;
    messageEstimateCache.delete(first);
  }
}
function cloneBreakdown(value) {
  return { ...value };
}
function estimateNonToolPart(part, options, breakdown) {
  if (!isRecord(part)) {
    if (part !== null && part !== undefined)
      addBreakdown(breakdown, "other", estimateStructured(part));
    return true;
  }
  const type = partType(part);
  if (type === "step-start" || type === "step-finish" || type === "meta" && Object.keys(part).length <= 1) {
    return true;
  }
  if (type === "text") {
    const text = firstStringField(part, ["text", "content"]);
    if (text)
      addBreakdown(breakdown, "text", estimateTokens(text));
    return true;
  }
  if (type === "reasoning" || type === "thinking" || type === "redacted_thinking") {
    const text = firstStringField(part, ["thinking", "text", "content", "reasoning"]);
    if (text) {
      addBreakdown(breakdown, "reasoning", estimateTokens(text));
    } else {
      addBreakdown(breakdown, "other", estimateStructured(part));
    }
    return true;
  }
  const reasoningText = firstStringField(part, ["thinking", "reasoning"]);
  if (reasoningText && type.length === 0) {
    addBreakdown(breakdown, "reasoning", estimateTokens(reasoningText));
    return true;
  }
  if (looksImageLike(part)) {
    addBreakdown(breakdown, "image", options.imageTokenHeuristic?.(part) ?? defaultImageTokenHeuristic(part));
    const altText = firstStringField(part, ["alt", "text", "description"]);
    if (altText)
      addBreakdown(breakdown, "text", estimateTokens(altText));
    return true;
  }
  if (type.includes("file") || type === "source") {
    const content = firstStringField(part, ["content", "text", "source"]);
    if (content)
      addBreakdown(breakdown, "text", estimateTokens(content));
    else
      addBreakdown(breakdown, "other", estimateStructured(part));
    return true;
  }
  return false;
}
function estimateTrueRawMessageTokens(message, options) {
  const breakdown = cloneBreakdown(EMPTY_BREAKDOWN);
  const countedInput = new Set;
  const countedOutput = new Set;
  let ordinalToolIndex = 0;
  for (const part of message.parts) {
    const signal = toolSignalFromPart(part);
    if (signal) {
      const localKey = `${signal.callId || "tool"}:${message.ordinal}:${ordinalToolIndex}`;
      ordinalToolIndex += 1;
      if (signal.hasInput) {
        const key = `${signal.callId}:input:${message.ordinal}`;
        if (!countedInput.has(key)) {
          countedInput.add(key);
          addBreakdown(breakdown, "toolInput", estimateTokens(signal.inputText));
        }
      }
      if (signal.hasOutput) {
        const key = `${signal.callId}:output:${message.ordinal}:${localKey}`;
        if (!countedOutput.has(key)) {
          countedOutput.add(key);
          addBreakdown(breakdown, "toolOutput", estimateTokens(signal.outputText));
        }
      }
      continue;
    }
    if (!estimateNonToolPart(part, options, breakdown)) {
      addBreakdown(breakdown, "other", estimateStructured(part));
    }
  }
  return breakdown;
}
function buildToolArcs(messages) {
  const openQueues = new Map;
  const arcs = [];
  for (const message of messages) {
    for (const part of message.parts) {
      const signal = toolSignalFromPart(part);
      if (!signal || signal.callId.length === 0)
        continue;
      if (signal.hasInput && signal.hasOutput) {
        arcs.push({
          callId: signal.callId,
          invOrdinal: message.ordinal,
          resOrdinal: message.ordinal
        });
        continue;
      }
      if (signal.hasInput) {
        const queue = openQueues.get(signal.callId) ?? [];
        queue.push(message.ordinal);
        openQueues.set(signal.callId, queue);
        continue;
      }
      if (signal.hasOutput) {
        const queue = openQueues.get(signal.callId) ?? [];
        const invOrdinal = queue.shift();
        if (queue.length === 0)
          openQueues.delete(signal.callId);
        else
          openQueues.set(signal.callId, queue);
        if (invOrdinal !== undefined) {
          arcs.push({ callId: signal.callId, invOrdinal, resOrdinal: message.ordinal });
        }
      }
    }
  }
  for (const [callId, queue] of openQueues) {
    for (const invOrdinal of queue) {
      arcs.push({ callId, invOrdinal, resOrdinal: null });
    }
  }
  return arcs.sort((a, b) => a.invOrdinal - b.invOrdinal || (a.resOrdinal ?? Number.MAX_SAFE_INTEGER) - (b.resOrdinal ?? Number.MAX_SAFE_INTEGER));
}
function fenceBoundaryForCompletedToolArcs(candidate, arcs, publicationFloorOrdinal, observeComponent) {
  const completed = arcs.filter((arc) => arc.resOrdinal !== null).map((arc) => ({ invocation: arc.invOrdinal, result: arc.resOrdinal }));
  const component = completed.filter((arc) => completedToolArcCrossesBoundary(arc.invocation, arc.result, candidate));
  if (component.length === 0)
    return candidate;
  for (let pass = 0;pass <= completed.length; pass += 1) {
    const minInvocation = Math.min(...component.map((arc) => arc.invocation));
    const maxResult = Math.max(...component.map((arc) => arc.result));
    const before = component.length;
    for (const arc of completed) {
      if (arc.invocation <= maxResult && arc.result >= minInvocation && !component.includes(arc)) {
        component.push(arc);
      }
    }
    if (component.length === before)
      break;
  }
  const minInvocation = Math.min(...component.map((arc) => arc.invocation));
  const maxResult = Math.max(...component.map((arc) => arc.result));
  observeComponent?.(component);
  return minInvocation < publicationFloorOrdinal ? maxResult + 1 : minInvocation;
}
function fenceBoundaryForToolArcs(candidate, arcs, lastCompartmentEndOrdinal, recentOpenArcCutoff) {
  const boundary = fenceBoundaryForCompletedToolArcs(candidate, arcs, lastCompartmentEndOrdinal + 1);
  for (const arc of arcs) {
    if (arc.resOrdinal !== null)
      continue;
    if (arc.invOrdinal < recentOpenArcCutoff)
      continue;
    if (arc.invOrdinal >= lastCompartmentEndOrdinal + 1 && arc.invOrdinal < boundary) {
      return arc.invOrdinal;
    }
    if (arc.invOrdinal >= boundary) {
      return arc.invOrdinal;
    }
  }
  return boundary;
}
function tokenForMessage(message, options) {
  const key = messageCacheKey(message, options);
  const cached = messageEstimateCache.get(key);
  if (cached)
    return cloneBreakdown(cached.breakdown);
  const breakdown = estimateTrueRawMessageTokens(message, options);
  setCachedEstimate(key, breakdown);
  return cloneBreakdown(breakdown);
}
function buildTrueRawTokenIndex(sessionId, messages, options) {
  const ordered = [...messages].sort((a, b) => a.ordinal - b.ordinal);
  const sliceCount = ordered.length;
  const firstOrdinal = ordered.length > 0 ? ordered[0].ordinal : 1;
  const terminalOrdinal = ordered.length > 0 ? ordered[ordered.length - 1].ordinal : 0;
  const rawMessageCount = Math.max(sliceCount, terminalOrdinal, options.absoluteMessageCount ?? sliceCount);
  const ordinalSpan = terminalOrdinal >= firstOrdinal ? terminalOrdinal - firstOrdinal + 1 : 0;
  const tokensByOrdinal = new Map;
  const idsByOrdinal = new Map;
  const prefix = new Array(ordinalSpan + 1).fill(0);
  for (const message of ordered) {
    const stored = options.storedTotalForMessage?.(message);
    let total;
    if (stored !== undefined && stored !== null) {
      total = stored;
    } else {
      const raw = tokenForMessage(message, options);
      const seed = options.calibration;
      total = seed ? (raw.toolInput + raw.toolOutput) * seed.toolsRatio + (raw.text + raw.reasoning + raw.other) * seed.proseRatio + raw.image : raw.total;
    }
    tokensByOrdinal.set(message.ordinal, total);
    idsByOrdinal.set(message.ordinal, message.id);
    const relative = message.ordinal - firstOrdinal + 1;
    if (relative >= 1 && relative <= ordinalSpan) {
      prefix[relative] = total;
    }
  }
  for (let k = 1;k <= ordinalSpan; k += 1) {
    prefix[k] += prefix[k - 1];
  }
  const ordinalToIndex = (ordinal) => Math.max(0, Math.min(ordinalSpan, ordinal - firstOrdinal));
  return {
    sessionId,
    providerShapeVersion: options.providerShapeVersion,
    rawMessageCount,
    tokenForOrdinal(ordinal) {
      return tokensByOrdinal.get(ordinal) ?? 0;
    },
    messageIdAtOrdinal(ordinal) {
      return idsByOrdinal.get(ordinal) ?? null;
    },
    suffixTokensFromOrdinal(ordinal) {
      if (ordinal <= firstOrdinal)
        return prefix[ordinalSpan];
      if (ordinal > terminalOrdinal)
        return 0;
      return prefix[ordinalSpan] - prefix[ordinalToIndex(ordinal)];
    },
    rangeTokens(startInclusive, endExclusive) {
      const start = Math.max(firstOrdinal, startInclusive);
      const end = Math.max(start, Math.min(terminalOrdinal + 1, endExclusive));
      return prefix[end - firstOrdinal] - prefix[start - firstOrdinal];
    },
    findSuffixStartForTokens(tokens) {
      if (!Number.isFinite(tokens) || tokens <= 0)
        return terminalOrdinal + 1;
      const target = Math.max(0, Math.floor(tokens));
      const total = prefix[ordinalSpan];
      if (total < target)
        return firstOrdinal;
      const cut = total - target;
      let lo = 0;
      let hi = ordinalSpan;
      let best = 0;
      while (lo <= hi) {
        const mid = lo + hi >> 1;
        if (prefix[mid] <= cut) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      return firstOrdinal + best;
    },
    findHeadEndForCap(startInclusive, endExclusive, capTokens) {
      const start = Math.max(firstOrdinal, Math.min(terminalOrdinal + 1, startInclusive));
      const end = Math.max(start, Math.min(terminalOrdinal + 1, endExclusive));
      if (!Number.isFinite(capTokens) || capTokens <= 0)
        return start;
      const startIndex = start - firstOrdinal;
      const endIndex = end - firstOrdinal;
      const cut = prefix[startIndex] + Math.floor(capTokens);
      let lo = startIndex + 1;
      let hi = endIndex;
      let bestEndIndex = startIndex;
      while (lo <= hi) {
        const mid = lo + hi >> 1;
        if (prefix[mid] <= cut) {
          bestEndIndex = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      let bestEnd = firstOrdinal + bestEndIndex;
      if (bestEnd === start && start < end)
        bestEnd = start + 1;
      return Math.min(bestEnd, end);
    }
  };
}
function partContentFingerprint(part) {
  if (!isRecord(part))
    return `${typeof part}:${recursiveByteLength(part)}`;
  const tool = toolSignalFromPart(part);
  if (tool) {
    return contentStringsHash([tool.inputText, tool.outputText]);
  }
  const text = firstStringField(part, ["text", "thinking", "reasoning", "content", "url"]) ?? "";
  return contentStringsHash([text]);
}
function computeRawRangeFingerprint(messages, startInclusive, endExclusive) {
  const pieces = [];
  for (const message of messages) {
    if (message.ordinal < startInclusive || message.ordinal >= endExclusive)
      continue;
    const partFingerprint = message.parts.map(partContentFingerprint).join(",");
    pieces.push(`${message.ordinal}:${message.id}:${message.parts.length}:${partFingerprint}`);
  }
  return pieces.join("|");
}
function invalidateTrueRawTokenCache(args) {
  const sessionNeedle = args.sessionId ? `${args.sessionId}` : null;
  const messageNeedle = args.messageId ? `\x00${args.messageId}\x00` : null;
  for (const [key, value] of messageEstimateCache) {
    const sessionMatches = sessionNeedle === null || key.includes(sessionNeedle);
    const messageMatches = messageNeedle === null || key.includes(messageNeedle);
    if (sessionMatches && messageMatches) {
      messageEstimateCache.delete(key);
      messageEstimateCacheBytes -= value.keyEstimateBytes;
    }
  }
  args.reason;
}

// ../plugin/src/hooks/magic-context/tag-part-guards.ts
function isTextPart(part) {
  if (part === null || typeof part !== "object")
    return false;
  const p = part;
  return p.type === "text" && typeof p.text === "string";
}
function isFilePart(part) {
  if (part === null || typeof part !== "object")
    return false;
  const p = part;
  return p.type === "file" && typeof p.url === "string";
}

// ../plugin/src/hooks/magic-context/dropped-input-guard.ts
var LEGACY_TRUNCATED_VALUE = /^[\s\S]{0,5}\.\.\.\[truncated\]$/;
var MAX_QUOTED_ARGUMENTS = 160;
var MAX_LISTED_PARAMETERS = 12;
var MAX_TRACKED_SESSIONS = 1000;
function isDroppedPlaceholderString(value) {
  return value.startsWith("[dropped §") && value.endsWith("§]") || LEGACY_TRUNCATED_VALUE.test(value) || value === "[object]" || /^\[\d+ items\]$/.test(value);
}
function droppedInputMarker(tagId) {
  return { dropped: `[dropped §${tagId}§]` };
}
function containsDroppedInputPlaceholder(value) {
  const seen = new WeakSet;
  const visit = (candidate) => {
    if (typeof candidate === "string")
      return isDroppedPlaceholderString(candidate);
    if (candidate === null || typeof candidate !== "object")
      return false;
    if (seen.has(candidate))
      return false;
    seen.add(candidate);
    if (Array.isArray(candidate))
      return candidate.some(visit);
    return Object.values(candidate).some(visit);
  };
  return visit(value);
}
function isRecord2(value) {
  return value !== null && typeof value === "object";
}
function isOptionalZodField(field) {
  if (!isRecord2(field))
    return false;
  const isOptional = field.isOptional;
  if (typeof isOptional === "function") {
    try {
      return isOptional.call(field) === true;
    } catch {}
  }
  const internals = field._zod;
  return internals?.optin === "optional";
}
function toolParameterNames(schema) {
  if (!isRecord2(schema))
    return;
  const properties = schema.properties;
  if (isRecord2(properties) && !Array.isArray(properties)) {
    const names = Object.keys(properties);
    const requiredList = Array.isArray(schema.required) ? schema.required : [];
    const required = new Set(requiredList.filter((name) => typeof name === "string"));
    return {
      required: names.filter((name) => required.has(name)),
      optional: names.filter((name) => !required.has(name))
    };
  }
  let shape;
  try {
    shape = schema.shape;
  } catch {
    shape = undefined;
  }
  if (isRecord2(shape) && !Array.isArray(shape)) {
    const result = { required: [], optional: [] };
    for (const [name, field] of Object.entries(shape)) {
      (isOptionalZodField(field) ? result.optional : result.required).push(name);
    }
    return result;
  }
  return;
}
var recordedToolParameters = new Map;
function quoteArguments(input) {
  let text;
  try {
    text = JSON.stringify(input) ?? String(input);
  } catch {
    text = String(input);
  }
  return text.length > MAX_QUOTED_ARGUMENTS ? `${text.slice(0, MAX_QUOTED_ARGUMENTS - 1)}…` : text;
}
function ordinal(value) {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 13)
    return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}
function describeParameters(names) {
  if (!names || names.required.length + names.optional.length === 0) {
    return "the tool's own parameters";
  }
  const listed = [...names.required.map((name) => `${name} (required)`), ...names.optional];
  const shown = listed.slice(0, MAX_LISTED_PARAMETERS);
  const more = listed.length > shown.length ? ", …" : "";
  return `its parameters: ${shown.join(", ")}${more}`;
}
function droppedInputRefusalMessage(refusal) {
  const tool = refusal.toolName ? `\`${refusal.toolName}\`` : undefined;
  const names = toolParameterNames(refusal.parameters) ?? (refusal.toolName ? recordedToolParameters.get(refusal.toolName) : undefined);
  const lines = [];
  if (refusal.consecutive >= 2) {
    lines.push(`This is the ${ordinal(refusal.consecutive)} call in a row with placeholder arguments.`);
  }
  lines.push(`Not executed: your arguments${tool ? ` to ${tool}` : ""} were ${quoteArguments(refusal.input)}. That is the placeholder Magic Context shows in place of an earlier call's arguments, not a value to send. Nothing is wrong with the session or the tool.`, `Call ${tool ?? "the tool"} again with real values for ${describeParameters(names)}.`, "Only if you need the original arguments of an earlier dropped call, recover them with ctx_expand first.");
  return lines.join(`
`);
}
function createDroppedInputGuard(options = {}) {
  const consecutiveBySession = new Map;
  return {
    check(call) {
      const session = call.sessionID ?? "";
      if (!containsDroppedInputPlaceholder(call.input)) {
        consecutiveBySession.delete(session);
        return;
      }
      const consecutive = (consecutiveBySession.get(session) ?? 0) + 1;
      consecutiveBySession.delete(session);
      consecutiveBySession.set(session, consecutive);
      if (consecutiveBySession.size > MAX_TRACKED_SESSIONS) {
        const oldest = consecutiveBySession.keys().next().value;
        if (oldest !== undefined)
          consecutiveBySession.delete(oldest);
      }
      let parameters;
      if (call.toolName && options.parametersFor) {
        try {
          parameters = options.parametersFor(call.toolName);
        } catch {
          parameters = undefined;
        }
      }
      return droppedInputRefusalMessage({
        toolName: call.toolName,
        input: call.input,
        parameters,
        consecutive
      });
    }
  };
}

// ../plugin/src/hooks/magic-context/edit-marker.ts
var TRUNCATION_SENTINEL = "...[truncated]";
var EDIT_REGION_HINT_LEN = 40;
var PATH_KEYS = new Set(["filePath", "file_path", "path"]);
var DIFF_KEYS = new Set(["oldString", "newString", "content", "old_string", "new_string"]);
function safeSlice(str, maxLen) {
  if (str.length <= maxLen)
    return str;
  const lastCharCode = str.charCodeAt(maxLen - 1);
  if (lastCharCode >= 55296 && lastCharCode <= 56319) {
    return str.slice(0, maxLen - 1);
  }
  return str.slice(0, maxLen);
}
function isEditTool(name) {
  return name === "edit" || name === "write";
}
function applyEditMarkerToInput(input) {
  for (const key of Object.keys(input)) {
    if (PATH_KEYS.has(key))
      continue;
    const value = input[key];
    if (typeof value !== "string" || !DIFF_KEYS.has(key))
      continue;
    if (value.endsWith(TRUNCATION_SENTINEL))
      continue;
    input[key] = value.length > EDIT_REGION_HINT_LEN ? `${safeSlice(value, EDIT_REGION_HINT_LEN)}${TRUNCATION_SENTINEL}` : value;
  }
}

// ../plugin/src/features/magic-context/tool-definition-tokens.ts
var measurements = new Map;
var fingerprints = new Map;
var persistenceDb = null;
var cachedInsertStmt = null;
function keyFor(providerID, modelID, agentName) {
  const agent = agentName && agentName.length > 0 ? agentName : "default";
  return `${providerID}/${modelID}/${agent}`;
}
function setDatabase(db) {
  persistenceDb = db;
  cachedInsertStmt = null;
}
function loadToolDefinitionMeasurements(db) {
  let rows = [];
  try {
    rows = db.prepare("SELECT provider_id, model_id, agent_name, tool_id, token_count FROM tool_definition_measurements").all();
  } catch {
    return;
  }
  for (const row of rows) {
    const key = keyFor(row.provider_id, row.model_id, row.agent_name);
    let inner = measurements.get(key);
    if (!inner) {
      inner = new Map;
      measurements.set(key, inner);
    }
    inner.set(row.tool_id, row.token_count);
  }
}

// ../plugin/src/hooks/magic-context/tokenizer-calibration-seeds.json
var tokenizer_calibration_seeds_default = [
  {
    prefix: "google/gemini-3.8-flash",
    systemRatio: 0.961167,
    toolsRatio: 0.967504,
    proseRatio: 1.006909
  },
  {
    prefix: "google/gemini-3.7-flash",
    systemRatio: 0.961167,
    toolsRatio: 0.967504,
    proseRatio: 1.006909
  },
  {
    prefix: "google/gemini-3.1-pro-preview",
    systemRatio: 0.961167,
    toolsRatio: 0.967504,
    proseRatio: 1.006909
  },
  {
    prefix: "anthropic/claude-fable-5-1",
    systemRatio: 1.511497,
    toolsRatio: 1.551639,
    proseRatio: 1.571778
  },
  {
    prefix: "anthropic/claude-opus-5",
    systemRatio: 1.511497,
    toolsRatio: 1.551639,
    proseRatio: 1.571778
  },
  {
    prefix: "anthropic/claude-sonnet-5",
    systemRatio: 1.511497,
    toolsRatio: 1.554814,
    proseRatio: 1.571815
  },
  {
    prefix: "openrouter/anthropic/claude-fable-5-1",
    systemRatio: 1.511497,
    toolsRatio: 1.551639,
    proseRatio: 1.571778
  },
  {
    prefix: "openrouter/anthropic/claude-opus-5",
    systemRatio: 1.511497,
    toolsRatio: 1.551639,
    proseRatio: 1.571778
  },
  {
    prefix: "openrouter/anthropic/claude-sonnet-5",
    systemRatio: 1.511497,
    toolsRatio: 1.554814,
    proseRatio: 1.571815
  },
  {
    prefix: "github-copilot/claude-fable-5-1",
    systemRatio: 1.511497,
    toolsRatio: 1.551639,
    proseRatio: 1.571778
  },
  {
    prefix: "github-copilot/claude-opus-5",
    systemRatio: 1.511497,
    toolsRatio: 1.551639,
    proseRatio: 1.571778
  },
  {
    prefix: "github-copilot/claude-sonnet-5",
    systemRatio: 1.511497,
    toolsRatio: 1.554814,
    proseRatio: 1.571815
  },
  {
    prefix: "anthropic/claude-opus-4-8",
    systemRatio: 1.51,
    toolsRatio: 1.57
  },
  {
    prefix: "anthropic/claude-opus-4.8",
    systemRatio: 1.51,
    toolsRatio: 1.57
  },
  {
    prefix: "anthropic/claude-opus-4-7",
    systemRatio: 1.51,
    toolsRatio: 1.57,
    proseRatio: 1.571778
  },
  {
    prefix: "anthropic/claude-opus-4.7",
    systemRatio: 1.51,
    toolsRatio: 1.57
  },
  {
    prefix: "anthropic/claude-opus-4-5",
    systemRatio: 1.02,
    toolsRatio: 1.16
  },
  {
    prefix: "anthropic/claude-opus-4.5",
    systemRatio: 1.02,
    toolsRatio: 1.16
  },
  {
    prefix: "anthropic/claude-opus-4-6",
    systemRatio: 1.02,
    toolsRatio: 1.16
  },
  {
    prefix: "anthropic/claude-opus-4.6",
    systemRatio: 1.02,
    toolsRatio: 1.16
  },
  {
    prefix: "anthropic/claude-sonnet-4-5",
    systemRatio: 1.02,
    toolsRatio: 1.16
  },
  {
    prefix: "anthropic/claude-sonnet-4.5",
    systemRatio: 1.02,
    toolsRatio: 1.16
  },
  {
    prefix: "anthropic/claude-sonnet-4-6",
    systemRatio: 1.02,
    toolsRatio: 1.14,
    proseRatio: 1.057976
  },
  {
    prefix: "anthropic/claude-sonnet-4.6",
    systemRatio: 1.02,
    toolsRatio: 1.14
  },
  {
    prefix: "anthropic/claude-haiku-4-5",
    systemRatio: 1.02,
    toolsRatio: 1.16
  },
  {
    prefix: "anthropic/claude-haiku-4.5",
    systemRatio: 1.02,
    toolsRatio: 1.16
  },
  {
    prefix: "openrouter/anthropic/claude-opus-4-8",
    systemRatio: 1.51,
    toolsRatio: 1.57
  },
  {
    prefix: "openrouter/anthropic/claude-opus-4.8",
    systemRatio: 1.51,
    toolsRatio: 1.57
  },
  {
    prefix: "github-copilot/claude-opus-4-8",
    systemRatio: 1.51,
    toolsRatio: 1.57
  },
  {
    prefix: "github-copilot/claude-opus-4.8",
    systemRatio: 1.51,
    toolsRatio: 1.57
  },
  {
    prefix: "openrouter/anthropic/claude-opus-4-7",
    systemRatio: 1.51,
    toolsRatio: 1.57
  },
  {
    prefix: "openrouter/anthropic/claude-opus-4.7",
    systemRatio: 1.51,
    toolsRatio: 1.57
  },
  {
    prefix: "github-copilot/claude-opus-4-7",
    systemRatio: 1.51,
    toolsRatio: 1.57
  },
  {
    prefix: "github-copilot/claude-opus-4.7",
    systemRatio: 1.51,
    toolsRatio: 1.57
  },
  {
    prefix: "openrouter/anthropic/claude-sonnet-4.6",
    systemRatio: 1.02,
    toolsRatio: 1.14
  },
  {
    prefix: "github-copilot/claude-sonnet-4.6",
    systemRatio: 1.02,
    toolsRatio: 1.14
  },
  {
    prefix: "github-copilot/claude-sonnet-4.5",
    systemRatio: 1.02,
    toolsRatio: 1.16
  },
  {
    prefix: "github-copilot/claude-opus-4.5",
    systemRatio: 1.02,
    toolsRatio: 1.16
  },
  {
    prefix: "github-copilot/claude-haiku-4.5",
    systemRatio: 1.02,
    toolsRatio: 1.16
  },
  {
    prefix: "openai/gpt-5.5",
    systemRatio: 1.000278,
    toolsRatio: 0.850953,
    proseRatio: 1.000017
  },
  {
    prefix: "openai/gpt-6-astra",
    systemRatio: 1.000278,
    toolsRatio: 0.850953,
    proseRatio: 1.000017
  },
  {
    prefix: "openai/gpt-5",
    systemRatio: 1,
    toolsRatio: 0.84
  },
  {
    prefix: "xai/grok-4-latest",
    systemRatio: 0.817751,
    toolsRatio: 0.880494,
    proseRatio: 0.880137
  },
  {
    prefix: "xai/grok-code-fast-1",
    systemRatio: 0.817751,
    toolsRatio: 0.880494,
    proseRatio: 0.880137
  },
  {
    prefix: "xai/grok-4",
    systemRatio: 0.82,
    toolsRatio: 0.88
  },
  {
    prefix: "xai/grok-code-fast",
    systemRatio: 0.82,
    toolsRatio: 0.89
  },
  {
    prefix: "cerebras/qwen-3-235b",
    systemRatio: 1,
    toolsRatio: 1.1
  },
  {
    prefix: "cerebras/zai-glm-4.7",
    systemRatio: 1,
    toolsRatio: 1.09
  },
  {
    prefix: "cerebras/gpt-oss-120b",
    systemRatio: 0.84,
    toolsRatio: 0.79
  },
  {
    prefix: "fireworks-ai/accounts/fireworks/models/glm-5p1",
    systemRatio: 1,
    toolsRatio: 1.06
  },
  {
    prefix: "fireworks-ai/accounts/fireworks/models/deepseek-v3p2",
    systemRatio: 1.05,
    toolsRatio: 1.09
  },
  {
    prefix: "opencode-go/glm-5.1",
    systemRatio: 1,
    toolsRatio: 1.06
  },
  {
    prefix: "opencode-go/glm-5",
    systemRatio: 1,
    toolsRatio: 1.06
  },
  {
    prefix: "opencode-go/kimi-k2.6",
    systemRatio: 0.87,
    toolsRatio: 0.86,
    proseRatio: 0.925501
  },
  {
    prefix: "moonshot/kimi-k2.6",
    systemRatio: 0.872126,
    toolsRatio: 0.863853,
    proseRatio: 0.925501
  },
  {
    prefix: "moonshot/kimi-for-coding",
    systemRatio: 0.872126,
    toolsRatio: 0.863853,
    proseRatio: 0.925501
  },
  {
    prefix: "zai/glm-4.7",
    systemRatio: 0.999721,
    toolsRatio: 1.056823,
    proseRatio: 1.000875
  },
  {
    prefix: "meta/muse-spark",
    systemRatio: 0.865949,
    toolsRatio: 1.024605,
    proseRatio: 0.923366
  },
  {
    prefix: "opencode/muse-spark",
    systemRatio: 0.865949,
    toolsRatio: 1.024605,
    proseRatio: 0.923366
  }
];

// ../plugin/src/hooks/magic-context/tokenizer-calibration.ts
var CALIBRATION_TABLE = tokenizer_calibration_seeds_default;
var NEUTRAL = { systemRatio: 1, toolsRatio: 1, proseRatio: 1 };
var CALIBRATION_TABLE_REVISION = "2026-09-23-model-id-generation-v2";
var UNKNOWN_FIT_RATIO = Math.max(2, ...CALIBRATION_TABLE.flatMap((entry) => [
  entry.systemRatio,
  entry.toolsRatio,
  entry.proseRatio ?? 1
]));
function hasModelCalibration(providerId, modelId) {
  return resolveModelCalibration(providerId, modelId) !== NEUTRAL;
}
function resolveModelCalibration(providerId, modelId) {
  if (!providerId || !modelId)
    return NEUTRAL;
  const key = `${providerId}/${modelId}`.toLowerCase();
  let best = null;
  for (const entry of CALIBRATION_TABLE) {
    const prefix = entry.prefix.toLowerCase();
    if (!key.startsWith(prefix))
      continue;
    if (!best || prefix.length > best.prefix.length) {
      best = entry;
    }
  }
  if (best)
    return { ...best, proseRatio: best.proseRatio ?? 1 };
  const provider = providerId.toLowerCase();
  const model = modelId.toLowerCase();
  if (CALIBRATION_TABLE.some((entry) => entry.prefix.toLowerCase().startsWith(`${provider}/`))) {
    return resolveFamilyFallback(provider, model) ?? NEUTRAL;
  }
  const canonical = canonicalProvider(model);
  let modelMatch = null;
  for (const entry of CALIBRATION_TABLE) {
    const seedModel = entry.prefix.toLowerCase().split("/").slice(1).join("/");
    if (!model.startsWith(seedModel))
      continue;
    const oldModel = modelMatch?.prefix.toLowerCase().split("/").slice(1).join("/") ?? "";
    if (seedModel.length > oldModel.length || seedModel.length === oldModel.length && entry.prefix.toLowerCase().startsWith(`${canonical}/`) && !modelMatch?.prefix.toLowerCase().startsWith(`${canonical}/`))
      modelMatch = entry;
  }
  if (modelMatch)
    return {
      ...modelMatch,
      proseRatio: modelMatch.proseRatio ?? 1,
      derivedFrom: modelMatch.prefix,
      matchedByModelId: true
    };
  const inherited = canonical ? resolveFamilyFallback(canonical, model) : null;
  return inherited ? { ...inherited, matchedByModelId: true } : NEUTRAL;
}
function parseModelLineage(modelId) {
  const tokens = modelId.split("-");
  const versionAt = tokens.findIndex((token) => /^\d+(\.\d+)*$/.test(token));
  if (versionAt <= 0)
    return null;
  const version = [];
  let end = versionAt;
  while (end < tokens.length && /^\d+(\.\d+)*$/.test(tokens[end] ?? "")) {
    for (const part of (tokens[end] ?? "").split("."))
      version.push(Number(part));
    end += 1;
  }
  return {
    family: tokens.slice(0, versionAt).join("-"),
    version,
    variant: tokens.slice(end).join("-")
  };
}
function canonicalProvider(model) {
  if (model.startsWith("claude-"))
    return "anthropic";
  if (model.startsWith("gpt-"))
    return "openai";
  if (model.startsWith("gemini-"))
    return "google";
  return "";
}
function compareVersions(a, b) {
  const length = Math.max(a.length, b.length);
  for (let i = 0;i < length; i++) {
    const delta = (a[i] ?? 0) - (b[i] ?? 0);
    if (delta !== 0)
      return delta;
  }
  return 0;
}
function resolveFamilyFallback(providerId, modelId) {
  const wanted = parseModelLineage(modelId);
  if (!wanted)
    return null;
  let below = null;
  let above = null;
  for (const entry of CALIBRATION_TABLE) {
    const prefix = entry.prefix.toLowerCase();
    if (!prefix.startsWith(`${providerId}/`))
      continue;
    const lineage = parseModelLineage(prefix.slice(providerId.length + 1));
    if (!lineage || lineage.family !== wanted.family || lineage.variant !== wanted.variant)
      continue;
    const order = compareVersions(lineage.version, wanted.version);
    if (order === 0)
      continue;
    if (order < 0) {
      if (!below || compareVersions(lineage.version, below.version) > 0) {
        below = { entry, version: lineage.version };
      }
    } else if (!above || compareVersions(lineage.version, above.version) < 0) {
      above = { entry, version: lineage.version };
    }
  }
  let source = below ?? above;
  if (source?.version[0] !== wanted.version[0] && canonicalProvider(modelId) !== "") {
    let sibling = null;
    for (const entry of CALIBRATION_TABLE) {
      const prefix = entry.prefix.toLowerCase();
      if (!prefix.startsWith(`${providerId}/`))
        continue;
      const lineage = parseModelLineage(prefix.slice(providerId.length + 1));
      if (!lineage || lineage.version[0] !== wanted.version[0] || lineage.variant !== wanted.variant || lineage.family.split("-")[0] !== wanted.family.split("-")[0])
        continue;
      const candidate = { entry, version: lineage.version };
      if (!sibling || compareVersions(candidate.version, wanted.version) <= 0 && compareVersions(sibling.version, wanted.version) > 0 || compareVersions(candidate.version, wanted.version) <= 0 && compareVersions(candidate.version, sibling.version) > 0 || compareVersions(sibling.version, wanted.version) > 0 && compareVersions(candidate.version, sibling.version) < 0)
        sibling = candidate;
    }
    source = sibling ?? source;
  }
  if (!source)
    return null;
  return {
    systemRatio: source.entry.systemRatio,
    toolsRatio: source.entry.toolsRatio,
    proseRatio: source.entry.proseRatio ?? 1,
    derivedFrom: source.entry.prefix
  };
}

// ../plugin/src/hooks/magic-context/decision-calibration.ts
function resolveDecisionCalibration(providerId, modelId) {
  const ratios = resolveModelCalibration(providerId, modelId);
  return Object.freeze({
    ...ratios,
    modelKey: `${providerId ?? "unknown"}/${modelId ?? "unknown"}`.toLowerCase(),
    revision: CALIBRATION_TABLE_REVISION,
    matchedPrefix: ratios.derivedFrom ?? ratios.prefix,
    seeded: hasModelCalibration(providerId, modelId),
    source: ratios.matchedByModelId ? "model-id" : ratios.derivedFrom ? "family-fallback" : "seed"
  });
}
function providerMass(raw, seed, fit = false) {
  const { system = 0, tools = 0, prose = 0 } = raw;
  if ([system, tools, prose].some((count) => !Number.isFinite(count) || count < 0) || [seed.systemRatio, seed.toolsRatio, seed.proseRatio].some((ratio) => !Number.isFinite(ratio) || ratio <= 0)) {
    return Number.POSITIVE_INFINITY;
  }
  const total = fit && !seed.seeded ? (system + tools + prose) * UNKNOWN_FIT_RATIO : system * seed.systemRatio + tools * seed.toolsRatio + prose * seed.proseRatio;
  return Number.isFinite(total) ? Math.ceil(total) : Number.POSITIVE_INFINITY;
}
function localBudget(providerTokens, ratio) {
  if (!Number.isFinite(providerTokens) || providerTokens <= 0 || !Number.isFinite(ratio) || ratio <= 0)
    return 0;
  return Math.floor(providerTokens / ratio);
}
function calibrationForModelKey(modelKey) {
  const slash = modelKey?.indexOf("/") ?? -1;
  return modelKey != null && slash > 0 ? resolveDecisionCalibration(modelKey.slice(0, slash), modelKey.slice(slash + 1)) : resolveDecisionCalibration(undefined, undefined);
}
function historyLocalBudget(providerTokens, modelKey) {
  const ratio = calibrationForModelKey(modelKey).proseRatio;
  return ratio === 1 ? providerTokens : localBudget(providerTokens, ratio);
}

// ../plugin/src/hooks/magic-context/tool-drop-target.ts
var IGNORE_PART_TYPES = new Set([
  "thinking",
  "reasoning",
  "redacted_thinking",
  "meta",
  "step-start",
  "step-finish"
]);
function isToolCallId(value) {
  return typeof value === "string" && value.length > 0;
}
function extractToolCallObservation(part) {
  if (!isRecord(part))
    return null;
  if (part.type === "tool" && isToolCallId(part.callID)) {
    return { callId: part.callID, kind: "result" };
  }
  if (part.type === "tool-invocation" && isToolCallId(part.callID)) {
    return { callId: part.callID, kind: "invocation" };
  }
  if (part.type === "tool_use" && isToolCallId(part.id)) {
    return { callId: part.id, kind: "invocation" };
  }
  if (part.type === "tool_result" && isToolCallId(part.tool_use_id)) {
    return { callId: part.tool_use_id, kind: "result" };
  }
  return null;
}

// ../plugin/src/hooks/magic-context/read-session-chunk.ts
var BLOCK_TOKEN_MEMO_MAX = 2048;
var blockTokenMemo = new Map;
function estimateBlockTokens(blockText) {
  const cached = blockTokenMemo.get(blockText);
  if (cached !== undefined) {
    blockTokenMemo.delete(blockText);
    blockTokenMemo.set(blockText, cached);
    return cached;
  }
  const count = estimateTokens(blockText);
  if (blockTokenMemo.size >= BLOCK_TOKEN_MEMO_MAX) {
    const oldest = blockTokenMemo.keys().next().value;
    if (oldest !== undefined)
      blockTokenMemo.delete(oldest);
  }
  blockTokenMemo.set(blockText, count);
  return count;
}
var activeRawMessageCache = null;
var activeAbsoluteCountCache = null;
var sessionProviders = new Map;
function resolveHostServedBoundaryId2(sessionId, messageId) {
  if (messageId.length === 0)
    return messageId;
  return sessionProviders.get(sessionId)?.readServedBoundaryId?.(messageId) ?? messageId;
}
function hasRawMessageProvider2(sessionId) {
  return sessionProviders.has(sessionId);
}
function setRawMessageProvider2(sessionId, provider) {
  sessionProviders.set(sessionId, provider);
  return () => {
    const current = sessionProviders.get(sessionId);
    if (current === provider)
      sessionProviders.delete(sessionId);
  };
}
function withRawMessageProvider2(sessionId, provider, fn) {
  const cleanup = setRawMessageProvider2(sessionId, provider);
  let result;
  try {
    result = fn();
  } catch (error) {
    cleanup();
    throw error;
  }
  if (result !== null && typeof result === "object" && typeof result.then === "function") {
    return result.finally(cleanup);
  }
  cleanup();
  return result;
}
function cleanUserText2(text) {
  return removeSystemReminders(text).replace(OMO_INTERNAL_INITIATOR_MARKER, "").trim();
}
function withRawSessionMessageCache2(fn) {
  const outerCache = activeRawMessageCache;
  if (!outerCache) {
    activeRawMessageCache = new Map;
    activeAbsoluteCountCache = new Map;
  }
  try {
    return fn();
  } finally {
    if (!outerCache) {
      activeRawMessageCache = null;
      activeAbsoluteCountCache = null;
    }
  }
}
function readRawSessionMessages2(sessionId) {
  if (activeRawMessageCache) {
    const cached = activeRawMessageCache.get(sessionId);
    if (cached?.coveredFromOrdinal === 1 && cached.coveredToOrdinal === null) {
      return cached.messages;
    }
    const messages = readRawSessionMessagesFromSource(sessionId);
    if (!cached) {
      activeRawMessageCache.set(sessionId, {
        messages,
        coveredFromOrdinal: 1,
        coveredToOrdinal: null
      });
    }
    return messages;
  }
  return readRawSessionMessagesFromSource(sessionId);
}
function readRawSessionMessagePage2(sessionId, afterOrdinal, limit, finalWatermark) {
  const provider = sessionProviders.get(sessionId);
  if (provider?.readMessagePage) {
    return provider.readMessagePage(afterOrdinal, limit, finalWatermark);
  }
  if (provider) {
    return provider.readMessages().filter((message) => message.ordinal > afterOrdinal && message.ordinal <= finalWatermark).slice(0, limit);
  }
  if (!openCodeDbExists())
    return [];
  return withReadOnlySessionDb((db) => readRawSessionMessagePageFromDb(db, sessionId, afterOrdinal, limit, finalWatermark));
}
function getRawSessionMessageOrdinalCount2(sessionId) {
  const provider = sessionProviders.get(sessionId);
  if (provider) {
    if (provider.getMessageCount)
      return provider.getMessageCount();
    const messages = provider.readMessages();
    return messages.reduce((maximum, message) => Math.max(maximum, message.ordinal), messages.length);
  }
  if (!openCodeDbExists())
    return 0;
  return withReadOnlySessionDb((db) => countRawSessionMessageOrdinalsFromDb(db, sessionId));
}
var RAW_MESSAGE_RANGE_PAGE_SIZE = 100;
function readRawSessionMessageRangeFromSource(sessionId, fromOrdinal, toOrdinal) {
  const provider = sessionProviders.get(sessionId);
  if (provider && !provider.readMessagePage) {
    return provider.readMessages().filter((message) => message.ordinal >= fromOrdinal && message.ordinal <= toOrdinal);
  }
  if (!provider && !openCodeDbExists())
    return [];
  const messages = [];
  let afterOrdinal = fromOrdinal - 1;
  while (afterOrdinal < toOrdinal) {
    const limit = Math.min(RAW_MESSAGE_RANGE_PAGE_SIZE, toOrdinal - afterOrdinal);
    const page = provider?.readMessagePage ? provider.readMessagePage(afterOrdinal, limit, toOrdinal) : withReadOnlySessionDb((db) => readRawSessionMessagePageFromDb(db, sessionId, afterOrdinal, limit, toOrdinal));
    if (page.length === 0)
      break;
    let nextOrdinal = afterOrdinal;
    for (const message of page) {
      if (message.ordinal < fromOrdinal || message.ordinal > toOrdinal)
        continue;
      messages.push(message);
      nextOrdinal = Math.max(nextOrdinal, message.ordinal);
    }
    if (nextOrdinal <= afterOrdinal)
      break;
    afterOrdinal = nextOrdinal;
  }
  return messages;
}
function readRawSessionMessageRange2(sessionId, fromOrdinal, toOrdinal) {
  const from = Math.max(1, Math.floor(fromOrdinal));
  const to = Math.floor(toOrdinal);
  if (to < from)
    return [];
  const cached = activeRawMessageCache?.get(sessionId);
  if (!cached)
    return readRawSessionMessageRangeFromSource(sessionId, from, to);
  const coveredTo = cached.coveredToOrdinal ?? Number.POSITIVE_INFINITY;
  const overlapFrom = Math.max(from, cached.coveredFromOrdinal);
  const overlapTo = Math.min(to, coveredTo);
  if (overlapTo < overlapFrom) {
    return readRawSessionMessageRangeFromSource(sessionId, from, to);
  }
  const messages = [];
  if (from < overlapFrom) {
    messages.push(...readRawSessionMessageRangeFromSource(sessionId, from, overlapFrom - 1));
  }
  messages.push(...cached.messages.filter((message) => message.ordinal >= overlapFrom && message.ordinal <= overlapTo));
  if (overlapTo < to) {
    messages.push(...readRawSessionMessageRangeFromSource(sessionId, overlapTo + 1, to));
  }
  return messages;
}
readRawSessionMessages2.readPage = readRawSessionMessagePage2;
readRawSessionMessages2.getCount = getRawSessionMessageOrdinalCount2;
function primeTailRawMessageCache2(args) {
  const { sessionId, lastCompartmentEnd, anchorMessageId } = args;
  if (!activeRawMessageCache)
    return false;
  if (activeRawMessageCache.has(sessionId))
    return false;
  if (lastCompartmentEnd < 1 || !anchorMessageId)
    return false;
  const provider = sessionProviders.get(sessionId);
  if (provider) {
    if (!provider.readMessagePage || !provider.getMessageCount)
      return false;
    const absoluteMessageCount = provider.getMessageCount();
    const messages = readRawSessionMessageRange2(sessionId, lastCompartmentEnd, absoluteMessageCount);
    if (messages.find((message) => message.ordinal === lastCompartmentEnd)?.id !== anchorMessageId)
      return false;
    activeRawMessageCache.set(sessionId, {
      messages,
      coveredFromOrdinal: lastCompartmentEnd,
      coveredToOrdinal: lastCompartmentEnd === 1 ? null : absoluteMessageCount
    });
    activeAbsoluteCountCache?.set(sessionId, absoluteMessageCount);
    return true;
  }
  if (!openCodeDbExists())
    return false;
  const result = withReadOnlySessionDb((db) => readRawSessionTailFromDb(db, sessionId, lastCompartmentEnd, anchorMessageId));
  if (!result)
    return false;
  activeRawMessageCache.set(sessionId, {
    messages: result.messages,
    coveredFromOrdinal: lastCompartmentEnd,
    coveredToOrdinal: lastCompartmentEnd === 1 ? null : result.absoluteMessageCount
  });
  activeAbsoluteCountCache?.set(sessionId, result.absoluteMessageCount);
  return true;
}
function getCachedAbsoluteMessageCount2(sessionId) {
  return activeAbsoluteCountCache?.get(sessionId) ?? null;
}
function primeInMemoryTailRawMessageCache2(args) {
  const { sessionId, messages, absoluteMessageCount } = args;
  if (!activeRawMessageCache)
    return false;
  if (activeRawMessageCache.has(sessionId))
    return false;
  const coveredFromOrdinal = messages[0]?.ordinal ?? absoluteMessageCount + 1;
  activeRawMessageCache.set(sessionId, {
    messages,
    coveredFromOrdinal,
    coveredToOrdinal: coveredFromOrdinal === 1 ? null : absoluteMessageCount
  });
  activeAbsoluteCountCache?.set(sessionId, absoluteMessageCount);
  return true;
}
function readRawSessionMessageIdOrdinalsForRange2(sessionId, fromOrdinal, toOrdinal) {
  const from = Math.max(1, Math.floor(fromOrdinal));
  const to = Math.floor(toOrdinal);
  if (to < from)
    return new Map;
  const provider = sessionProviders.get(sessionId);
  if (provider?.readMessageIdOrdinalsForRange) {
    return provider.readMessageIdOrdinalsForRange(from, to);
  }
  const all = provider?.readMessageIdOrdinals ? provider.readMessageIdOrdinals() : provider ? new Map(provider.readMessages().map((message) => [message.id, message.ordinal])) : !openCodeDbExists() ? new Map : withReadOnlySessionDb((db) => readRawSessionMessageIdOrdinalsFromDb(db, sessionId));
  return new Map([...all].filter(([, ordinal]) => ordinal >= from && ordinal <= to));
}
function hasRawSessionMessageById2(sessionId, messageId) {
  const provider = sessionProviders.get(sessionId);
  if (provider?.hasMessageById)
    return provider.hasMessageById(messageId);
  return readRawSessionMessageById(sessionId, messageId) !== null;
}
function readRawSessionMessageById(sessionId, messageId) {
  const provider = sessionProviders.get(sessionId);
  if (provider?.readMessageById) {
    return provider.readMessageById(messageId);
  }
  if (provider) {
    return provider.readMessages().find((message) => message.id === messageId) ?? null;
  }
  if (!openCodeDbExists())
    return null;
  return withReadOnlySessionDb((db) => readRawSessionMessageByIdFromDb(db, sessionId, messageId));
}
function readRawSessionMessagesFromSource(sessionId) {
  const provider = sessionProviders.get(sessionId);
  if (provider)
    return provider.readMessages();
  if (!openCodeDbExists())
    return [];
  return withReadOnlySessionDb((db) => readRawSessionMessagesFromDb(db, sessionId));
}
function getRawSessionMessageCount2(sessionId) {
  const provider = sessionProviders.get(sessionId);
  if (provider) {
    if (provider.getMessageCount)
      return provider.getMessageCount();
    const messages = provider.readMessages();
    return messages.reduce((maximum, message) => Math.max(maximum, message.ordinal), messages.length);
  }
  if (!openCodeDbExists())
    return 0;
  return withReadOnlySessionDb((db) => getRawSessionMessageCountFromDb(db, sessionId));
}
var RAW_SESSION_TAG_KEY_PAGE_SIZE = 32;
function yieldRawSessionTagKeyPage() {
  return new Promise((resolve) => {
    const immediate = globalThis.setImmediate;
    if (typeof immediate === "function") {
      immediate(resolve);
      return;
    }
    setTimeout(resolve, 0);
  });
}
async function getRawSessionTagKeysThrough2(sessionId, upToMessageIndex, options = {}) {
  const messageFileKeys = new Set;
  const toolObservations = new Map;
  const unpairedInvocations = new Map;
  const candidateOwnersByCallId = new Map;
  const messageTimesById = new Map;
  const finalWatermark = Number.isFinite(upToMessageIndex) ? Math.max(0, Math.floor(upToMessageIndex)) : getRawSessionMessageOrdinalCount2(sessionId);
  const pageSize = Number.isFinite(options.pageSize) ? Math.max(1, Math.floor(options.pageSize ?? RAW_SESSION_TAG_KEY_PAGE_SIZE)) : RAW_SESSION_TAG_KEY_PAGE_SIZE;
  const yieldToEventLoop = options.yieldToEventLoop ?? yieldRawSessionTagKeyPage;
  const nearestPersistedOwner = (callId, currentMessageId) => {
    if (!options.db)
      return null;
    let candidates = candidateOwnersByCallId.get(callId);
    if (!candidates) {
      candidates = getCandidateToolOwners(options.db, sessionId, callId);
      candidateOwnersByCallId.set(callId, candidates);
    }
    if (candidates.length === 0)
      return null;
    const ids = [...candidates, currentMessageId];
    const unresolved = ids.filter((id) => !messageTimesById.has(id));
    if (unresolved.length > 0) {
      const resolved = getMessageTimesFromOpenCodeDb(sessionId, unresolved);
      for (const id of unresolved) {
        messageTimesById.set(id, resolved.get(id) ?? null);
      }
    }
    const times = new Map;
    for (const id of ids) {
      const time = messageTimesById.get(id);
      if (typeof time === "number")
        times.set(id, time);
    }
    return pickNearestPriorOwner(candidates, currentMessageId, times);
  };
  const firstOrdinal = Number.isFinite(options.fromMessageIndex) ? Math.max(1, Math.floor(options.fromMessageIndex ?? 1)) : 1;
  let afterOrdinal = firstOrdinal - 1;
  while (afterOrdinal < finalWatermark) {
    const messages = readRawSessionMessages2.readPage(sessionId, afterOrdinal, pageSize, finalWatermark);
    if (messages.length === 0)
      break;
    let nextOrdinal = afterOrdinal;
    for (const message of messages) {
      if (message.ordinal <= afterOrdinal || message.ordinal > finalWatermark)
        continue;
      nextOrdinal = Math.max(nextOrdinal, message.ordinal);
      messageTimesById.set(message.id, typeof message.createdAt === "number" ? message.createdAt : null);
      for (const [partIndex, part] of message.parts.entries()) {
        if (isTextPart(part)) {
          messageFileKeys.add(`${message.id}:p${partIndex}`);
          continue;
        }
        if (isFilePart(part)) {
          messageFileKeys.add(`${message.id}:file${partIndex}`);
          continue;
        }
        const observation = extractToolCallObservation(part);
        if (!observation)
          continue;
        let ownerMessageId;
        if (observation.kind === "invocation") {
          ownerMessageId = message.id;
          const queue = unpairedInvocations.get(observation.callId) ?? [];
          queue.push(message.id);
          unpairedInvocations.set(observation.callId, queue);
        } else {
          const queue = unpairedInvocations.get(observation.callId);
          const pairedOwner = queue?.shift();
          if (queue?.length === 0)
            unpairedInvocations.delete(observation.callId);
          ownerMessageId = pairedOwner ?? nearestPersistedOwner(observation.callId, message.id) ?? message.id;
        }
        const owners = toolObservations.get(observation.callId) ?? new Set;
        owners.add(ownerMessageId);
        toolObservations.set(observation.callId, owners);
      }
    }
    if (nextOrdinal <= afterOrdinal)
      break;
    afterOrdinal = nextOrdinal;
    if (afterOrdinal < finalWatermark)
      await yieldToEventLoop();
  }
  return { messageFileKeys, toolObservations };
}
var PROTECTED_TAIL_USER_TURNS = 5;
function getLegacyProtectedTailStartOrdinal2(sessionId) {
  const count = getRawSessionMessageOrdinalCount2(sessionId);
  const userOrdinals = [];
  let toOrdinal = count;
  while (toOrdinal >= 1 && userOrdinals.length < PROTECTED_TAIL_USER_TURNS) {
    const fromOrdinal = Math.max(1, toOrdinal - RAW_MESSAGE_RANGE_PAGE_SIZE + 1);
    const messages = readRawSessionMessageRange2(sessionId, fromOrdinal, toOrdinal);
    for (let index = messages.length - 1;index >= 0; index--) {
      const message = messages[index];
      if (message?.role === "user" && hasMeaningfulUserText2(message.parts)) {
        userOrdinals.push(message.ordinal);
        if (userOrdinals.length === PROTECTED_TAIL_USER_TURNS)
          break;
      }
    }
    toOrdinal = fromOrdinal - 1;
  }
  return userOrdinals.length < PROTECTED_TAIL_USER_TURNS ? 1 : userOrdinals[PROTECTED_TAIL_USER_TURNS - 1] ?? 1;
}
function readSessionChunk2(sessionId, tokenBudget, offset = 1, eligibleEndOrdinal) {
  const totalMessageCount = getCachedAbsoluteMessageCount2(sessionId) ?? getRawSessionMessageOrdinalCount2(sessionId);
  const startOrdinal = Math.max(1, offset);
  const finalOrdinal = eligibleEndOrdinal === undefined ? totalMessageCount : Math.min(totalMessageCount, eligibleEndOrdinal - 1);
  const messages = readRawSessionMessageRange2(sessionId, Math.max(1, startOrdinal - 1), finalOrdinal);
  const completedToolArcs = buildToolArcs(messages).flatMap((arc) => arc.resOrdinal === null ? [] : [{ start: arc.invOrdinal, end: arc.resOrdinal }]);
  const completedToolComponents = [];
  for (const arc of completedToolArcs) {
    const component = completedToolComponents[completedToolComponents.length - 1];
    if (component && arc.start <= component.end)
      component.end = Math.max(component.end, arc.end);
    else
      completedToolComponents.push({ ...arc });
  }
  const lines = [];
  const lineMeta = [];
  const flushedToolOnlyBlocks = [];
  let totalTokens = 0;
  let messagesProcessed = 0;
  let lastOrdinal = startOrdinal - 1;
  let highestScannedOrdinal = startOrdinal - 1;
  let lastMessageId = "";
  let firstMessageId = "";
  let currentBlock = null;
  let pendingNoiseMeta = [];
  let commitClusters = 0;
  let lastFlushedRole = "";
  let admittedOversizeComponentEnd = null;
  let currentBlockApproxTokens = 0;
  let formattedBudgetCrossed = false;
  let sourceCharacters = 0;
  const toolResultBoundaries = [];
  function pinComponentWhenFormattedBudgetCrosses(ordinal, appendedText) {
    if (admittedOversizeComponentEnd !== null || formattedBudgetCrossed || !currentBlock)
      return;
    currentBlockApproxTokens += estimateTokens(appendedText) + (currentBlock.parts.length > 1 ? 1 : 0);
    if (totalTokens + currentBlockApproxTokens + 64 <= tokenBudget)
      return;
    const previewTokens = totalTokens + estimateTokens(formatBlock(currentBlock));
    if (previewTokens <= tokenBudget)
      return;
    formattedBudgetCrossed = true;
    const component = completedToolComponents.find((candidate) => candidate.start <= ordinal && candidate.end >= ordinal);
    if (component)
      admittedOversizeComponentEnd = component.end;
  }
  function recordFilteredNoise(meta) {
    pendingNoiseMeta.push(meta);
    if (!currentBlock) {
      highestScannedOrdinal = Math.max(highestScannedOrdinal, meta.ordinal);
    }
  }
  function flushCurrentBlock() {
    if (!currentBlock)
      return true;
    const blockText = formatBlock(currentBlock);
    const blockTokens = estimateBlockTokens(blockText);
    if (totalTokens + blockTokens > tokenBudget && totalTokens > 0) {
      const splitsCompletedArc = completedToolArcs.some((arc) => arc.start <= lastOrdinal && arc.end > lastOrdinal);
      if (!splitsCompletedArc)
        return false;
    }
    if (currentBlock.role === "A" && currentBlock.commitHashes.length > 0 && lastFlushedRole !== "A") {
      commitClusters++;
    }
    lastFlushedRole = currentBlock.role;
    if (!firstMessageId)
      firstMessageId = currentBlock.meta[0]?.messageId ?? "";
    lastOrdinal = currentBlock.meta[currentBlock.meta.length - 1]?.ordinal ?? currentBlock.endOrdinal;
    highestScannedOrdinal = Math.max(highestScannedOrdinal, lastOrdinal);
    lastMessageId = currentBlock.meta[currentBlock.meta.length - 1]?.messageId ?? "";
    messagesProcessed += currentBlock.meta.length;
    const lineStart = sourceCharacters + (lines.length > 0 ? 1 : 0);
    const renderedParts = currentBlock.parts.join(" / ");
    let partOffset = lineStart + (blockText.length - renderedParts.length);
    for (let index = 0;index < currentBlock.parts.length; index++) {
      const part = currentBlock.parts[index] ?? "";
      const partMeta = currentBlock.partMeta[index];
      if (partMeta && partMeta.toolResultBodyTokens > 0) {
        toolResultBoundaries.push({
          ordinal: partMeta.ordinal,
          sourceOffset: partOffset,
          bodyTokens: partMeta.toolResultBodyTokens
        });
      }
      partOffset += part.length + (index + 1 < currentBlock.parts.length ? 3 : 0);
    }
    lines.push(blockText);
    sourceCharacters = lineStart + blockText.length;
    lineMeta.push(...currentBlock.meta);
    totalTokens += blockTokens;
    if (currentBlock.isToolOnly) {
      flushedToolOnlyBlocks.push({
        start: currentBlock.startOrdinal,
        end: currentBlock.endOrdinal
      });
    }
    currentBlock = null;
    currentBlockApproxTokens = 0;
    return true;
  }
  for (const msg of messages) {
    if (eligibleEndOrdinal !== undefined && msg.ordinal >= eligibleEndOrdinal)
      break;
    if (admittedOversizeComponentEnd !== null && msg.ordinal > admittedOversizeComponentEnd) {
      break;
    }
    if (msg.ordinal < startOrdinal)
      continue;
    const meta = { ordinal: msg.ordinal, messageId: msg.id };
    if (isHostUnservedRow(msg))
      markHostUnservedRow(meta);
    if (msg.role === "user" && !hasMeaningfulUserText2(msg.parts)) {
      const tcSummaries = extractToolCallSummaries(msg.parts);
      if (tcSummaries.length === 0) {
        recordFilteredNoise(meta);
        continue;
      }
      const tcText = tcSummaries.join(" / ");
      if (currentBlock && currentBlock.role === "A") {
        currentBlock.endOrdinal = msg.ordinal;
        currentBlock.parts.push(tcText);
        currentBlock.partMeta.push({
          ordinal: msg.ordinal,
          toolResultBodyTokens: extractToolResultBodyTokens(msg.parts)
        });
        currentBlock.meta.push(...pendingNoiseMeta, meta);
        pendingNoiseMeta = [];
      } else {
        if (!flushCurrentBlock())
          break;
        currentBlock = {
          role: "A",
          startOrdinal: pendingNoiseMeta[0]?.ordinal ?? msg.ordinal,
          endOrdinal: msg.ordinal,
          parts: [tcText],
          partMeta: [
            {
              ordinal: msg.ordinal,
              toolResultBodyTokens: extractToolResultBodyTokens(msg.parts)
            }
          ],
          meta: [...pendingNoiseMeta, meta],
          commitHashes: [],
          isToolOnly: true
        };
        pendingNoiseMeta = [];
      }
      pinComponentWhenFormattedBudgetCrosses(msg.ordinal, tcText);
      continue;
    }
    const role = compactRole(msg.role);
    const textParts = extractTexts2(msg.parts).map((t) => msg.role === "user" ? cleanUserText2(t) : t).map(normalizeText).filter((value) => value.length > 0);
    const toolSummaries = textParts.length === 0 ? extractToolCallSummaries(msg.parts) : [];
    const allParts = [...textParts, ...toolSummaries];
    const compacted = compactTextForSummary(allParts.join(" / "), msg.role);
    const text = compacted.text;
    if (!text) {
      recordFilteredNoise(meta);
      continue;
    }
    const msgHasNarrative = textParts.length > 0;
    if (currentBlock && currentBlock.role === role) {
      currentBlock.endOrdinal = msg.ordinal;
      currentBlock.parts.push(text);
      currentBlock.partMeta.push({
        ordinal: msg.ordinal,
        toolResultBodyTokens: extractToolResultBodyTokens(msg.parts)
      });
      currentBlock.meta.push(...pendingNoiseMeta, meta);
      currentBlock.commitHashes = mergeCommitHashes(currentBlock.commitHashes, compacted.commitHashes);
      if (msgHasNarrative)
        currentBlock.isToolOnly = false;
      pendingNoiseMeta = [];
      pinComponentWhenFormattedBudgetCrosses(msg.ordinal, text);
      continue;
    }
    if (!flushCurrentBlock())
      break;
    currentBlock = {
      role,
      startOrdinal: pendingNoiseMeta[0]?.ordinal ?? msg.ordinal,
      endOrdinal: msg.ordinal,
      parts: [text],
      partMeta: [
        {
          ordinal: msg.ordinal,
          toolResultBodyTokens: extractToolResultBodyTokens(msg.parts)
        }
      ],
      meta: [...pendingNoiseMeta, meta],
      commitHashes: [...compacted.commitHashes],
      isToolOnly: !msgHasNarrative
    };
    pendingNoiseMeta = [];
    pinComponentWhenFormattedBudgetCrosses(msg.ordinal, text);
  }
  if (flushCurrentBlock() && pendingNoiseMeta.length > 0) {
    highestScannedOrdinal = Math.max(highestScannedOrdinal, pendingNoiseMeta[pendingNoiseMeta.length - 1]?.ordinal ?? highestScannedOrdinal);
  }
  const toolOnlyRanges = [];
  for (const range of flushedToolOnlyBlocks) {
    const last = toolOnlyRanges[toolOnlyRanges.length - 1];
    if (last && range.start === last.end + 1) {
      last.end = range.end;
    } else {
      toolOnlyRanges.push({ start: range.start, end: range.end });
    }
  }
  const text = lines.join(`
`);
  const oversizeAtomicUnit = estimateBlockTokens(text) > tokenBudget && completedToolArcs.some((arc) => arc.start <= lastOrdinal && arc.end >= startOrdinal);
  return {
    startIndex: startOrdinal,
    endIndex: lastOrdinal,
    startMessageId: firstMessageId,
    endMessageId: lastMessageId,
    messageCount: messagesProcessed,
    tokenEstimate: totalTokens,
    ...oversizeAtomicUnit ? { oversizeAtomicUnit: true } : {},
    hasMore: Math.max(lastOrdinal, highestScannedOrdinal) < (eligibleEndOrdinal !== undefined ? Math.min(eligibleEndOrdinal - 1, totalMessageCount) : totalMessageCount),
    text,
    lines: lineMeta,
    ...messagesProcessed === 0 && text.length === 0 ? { filteredNoiseLines: pendingNoiseMeta } : {},
    commitClusterCount: commitClusters,
    toolOnlyRanges,
    completedToolArcs,
    toolResultBoundaries
  };
}
export { CTX_REDUCE_KEEP, newestCtxReduceTagNumbers, textMentionsRecentCommit, removeSystemReminders, hasMeaningfulUserText2, extractTexts2, extractToolCallSummaries, preloadTokenizer, estimateTokens, normalizeText, stripWellFormedLeadingTagPrefix, stripPersistedAssistantText, byteSize, stripTagPrefix, peelLeadingMcTagNotation, prependTag, isRecord, stableStringify, estimateImageTokensFromDataUrl, TODO_STATUSES, TODO_PRIORITIES, TITLE_DONE_STATUSES, normalizeTodoStateJson, buildSyntheticTodoPart, stripChannel1ReminderSpans, compareMeasuredTailPrefix, formatTailHygienePrefixMismatch, freezeTailHygieneMeasurement, effectiveTailHygiene, CHANNEL1_SENTINEL, CHANNEL1_FLOOR_TOKENS, decideChannel1, evaluateChannel2, reclaimableToolOutputCount, buildChannel2Reminder, buildChannel1Reminder, planEmergencyDrop, measureEmergencyTag, updateTagByteSize, getRecentTagOwnerMessageIds, AGE_RECLAIM_MIN_TOKENS, getOldestActiveUnprotectedToolTags, getActiveToolTagsForAgeReclaim, getTriggerTagTokenUpperBound, updateTagInputByteSize, updateTagTokenCount, getPersistedToolTagAccounting, getAllStatusTagTokenTotalsFlat, updateTagInputTokenCount, tagTokenCountIsNull, backfillTagTokenCounts, insertTag, updateTagStatus, getInertWhitespaceAssistantTags, updateTagDropMode, updateCavemanDepth, hasPiFallbackMessageTags, findAdoptableFallbackTags, hasPiFallbackToolOwnerTags, findPiFallbackToolOwnerTags, adoptPiFallbackToolOwnerTag, adoptPiFallbackMessageTag, getMaxTagNumberBySession, getTagNumberByMessageId, getAssignableTagNumberByMessageId, deriveTagLoadFloor, TAG_SELECT_COLUMNS, getTagsBySession, getActiveTagsBySession, getTagsForPendingOperations, getTagsByNumbers, getDroppedTagsByNumbers, getMaxDroppedTagNumber, getToolTagNumberByOwner, getNullOwnerToolTag, adoptNullOwnerToolTag, retreatPastHostUnservedRows, resolveOpenCodeDbPath, hasV1MessageTables, assertOpenCodeStoreGeneration, openCodeDbPathExists, getOpenCodeDbProbeDescriptions, recordOpenCodeDbReadFailure, clearOpenCodeDbReadFailure, claimOpenCodeDbDiagnosticOnce, registerSlowWriteReporter, detectSqliteRuntime, Database, withPrivilegedWriter, closeQuietly, withReadOnlySessionDb, completedToolArcCrossesBoundary, estimateTrueRawMessageTokens, buildToolArcs, fenceBoundaryForCompletedToolArcs, fenceBoundaryForToolArcs, buildTrueRawTokenIndex, computeRawRangeFingerprint, invalidateTrueRawTokenCache, droppedInputMarker, createDroppedInputGuard, isEditTool, applyEditMarkerToInput, setDatabase, loadToolDefinitionMeasurements, resolveDecisionCalibration, providerMass, localBudget, calibrationForModelKey, historyLocalBudget, resolveHostServedBoundaryId2, hasRawMessageProvider2, setRawMessageProvider2, withRawMessageProvider2, cleanUserText2, withRawSessionMessageCache2, readRawSessionMessages2, readRawSessionMessagePage2, getRawSessionMessageOrdinalCount2, readRawSessionMessageRange2, primeTailRawMessageCache2, getCachedAbsoluteMessageCount2, primeInMemoryTailRawMessageCache2, readRawSessionMessageIdOrdinalsForRange2, hasRawSessionMessageById2, getRawSessionMessageCount2, getRawSessionTagKeysThrough2, getLegacyProtectedTailStartOrdinal2, readSessionChunk2 };
