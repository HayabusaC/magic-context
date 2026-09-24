// src/subagent-usage-pricing.ts
import { appendFileSync, readFileSync, unlinkSync } from "node:fs";

// ../../node_modules/.bun/@oh-my-pi+pi-utils@18.2.10/node_modules/@oh-my-pi/pi-utils/src/lru.ts
function positiveInteger(value, name) {
  if (value === undefined)
    return 0;
  if (!Number.isInteger(value) || value < 0)
    throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

class LRUCache {
  #entries = new Map;
  #max;
  #maxSize;
  #maxEntrySize;
  #sizeCalculation;
  #ttl;
  #updateAgeOnGet;
  #dispose;
  #calculatedSize = 0;
  constructor(options) {
    this.#max = positiveInteger(options.max, "max");
    this.#maxSize = positiveInteger(options.maxSize, "maxSize");
    const explicitMaxEntrySize = positiveInteger(options.maxEntrySize, "maxEntrySize");
    this.#maxEntrySize = explicitMaxEntrySize || this.#maxSize;
    this.#ttl = positiveInteger(options.ttl, "ttl");
    if (this.#max === 0 && this.#maxSize === 0 && this.#ttl === 0) {
      throw new TypeError("At least one of max, maxSize, or ttl is required");
    }
    if ((this.#maxSize !== 0 || this.#maxEntrySize !== 0) && options.sizeCalculation === undefined) {
      throw new TypeError("sizeCalculation is required when a size limit is set");
    }
    this.#sizeCalculation = options.sizeCalculation;
    this.#updateAgeOnGet = options.updateAgeOnGet === true;
    this.#dispose = options.dispose;
  }
  get size() {
    return this.#entries.size;
  }
  get calculatedSize() {
    return this.#calculatedSize;
  }
  set(key, value) {
    if (value === undefined) {
      this.delete(key);
      return this;
    }
    const size = this.#entrySize(value, key);
    const previous = this.#entries.get(key);
    if (this.#maxEntrySize !== 0 && size > this.#maxEntrySize) {
      if (previous !== undefined)
        this.#remove(key, previous, "set");
      return this;
    }
    if (previous !== undefined) {
      if (previous.value !== value)
        this.#dispose?.(previous.value, key, "set");
      this.#calculatedSize -= previous.size;
      this.#entries.delete(key);
    }
    while (this.#max !== 0 && this.#entries.size >= this.#max || this.#maxSize !== 0 && this.#calculatedSize + size > this.#maxSize) {
      const oldest = this.#entries.entries().next().value;
      if (oldest === undefined)
        break;
      this.#remove(oldest[0], oldest[1], "evict");
    }
    this.#entries.set(key, { value, size, start: this.#ttl === 0 ? 0 : performance.now() });
    this.#calculatedSize += size;
    return this;
  }
  get(key) {
    const entry = this.#entries.get(key);
    if (entry === undefined)
      return;
    if (this.#isStale(entry)) {
      this.#remove(key, entry, "expire");
      return;
    }
    if (this.#updateAgeOnGet && this.#ttl !== 0)
      entry.start = performance.now();
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry.value;
  }
  has(key) {
    const entry = this.#entries.get(key);
    return entry !== undefined && !this.#isStale(entry);
  }
  peek(key) {
    const entry = this.#entries.get(key);
    return entry === undefined || this.#isStale(entry) ? undefined : entry.value;
  }
  delete(key) {
    const entry = this.#entries.get(key);
    if (entry === undefined)
      return false;
    this.#remove(key, entry, "delete");
    return true;
  }
  clear() {
    for (const [key, entry] of this.#entries)
      this.#dispose?.(entry.value, key, "delete");
    this.#entries.clear();
    this.#calculatedSize = 0;
  }
  *keys() {
    const entries = [...this.#entries.entries()];
    for (let index = entries.length - 1;index >= 0; index--) {
      const [key, entry] = entries[index];
      if (!this.#isStale(entry))
        yield key;
    }
  }
  *values() {
    const entries = [...this.#entries.values()];
    for (let index = entries.length - 1;index >= 0; index--) {
      const entry = entries[index];
      if (!this.#isStale(entry))
        yield entry.value;
    }
  }
  #entrySize(value, key) {
    if (this.#sizeCalculation === undefined)
      return 0;
    const size = this.#sizeCalculation(value, key);
    if (!Number.isInteger(size) || size <= 0)
      throw new TypeError("sizeCalculation return invalid (expect positive integer)");
    return size;
  }
  #isStale(entry) {
    return this.#ttl !== 0 && performance.now() - entry.start > this.#ttl;
  }
  #remove(key, entry, reason) {
    this.#dispose?.(entry.value, key, reason);
    this.#entries.delete(key);
    this.#calculatedSize -= entry.size;
  }
}
// ../../node_modules/.bun/@oh-my-pi+pi-catalog@18.2.10/node_modules/@oh-my-pi/pi-catalog/src/compat/cascade.ts
var globSegmentsCache = new Map;
var resolveCache = new LRUCache({ max: 512 });

// ../../node_modules/.bun/@oh-my-pi+pi-catalog@18.2.10/node_modules/@oh-my-pi/pi-catalog/src/compat/taxonomy.ts
var classifyMemo = new Map;
// ../../node_modules/.bun/@oh-my-pi+pi-catalog@18.2.10/node_modules/@oh-my-pi/pi-catalog/src/models.ts
var modelRegistry = new Map;
function resolveTokenCost(cost, promptInputTokens, timestamp) {
  let rates = cost;
  let effectiveFrom = -Infinity;
  if (timestamp !== undefined && cost.timeBased?.effectiveRates) {
    for (const candidate of cost.timeBased.effectiveRates) {
      if (candidate.effectiveFrom <= timestamp && candidate.effectiveFrom > effectiveFrom) {
        rates = candidate;
        effectiveFrom = candidate.effectiveFrom;
      }
    }
  }
  const longContext = rates.longContext;
  if (!longContext)
    return rates;
  const reachesThreshold = promptInputTokens > longContext.inputThreshold || longContext.inputThresholdInclusive === true && promptInputTokens === longContext.inputThreshold;
  return reachesThreshold ? longContext : rates;
}
function isPeakPricingPeriod(schedule, timestamp) {
  const day = Math.floor(timestamp / 86400000);
  const weekday = ((day + 4) % 7 + 7) % 7;
  const minute = Math.floor((timestamp - day * 86400000) / 60000);
  for (const window of schedule.peakWindows) {
    if (minute >= window.startMinute && minute < window.endMinute && window.weekdays.includes(weekday))
      return true;
  }
  return false;
}
function timeBasedMultiplier(schedule, timestamp) {
  if (!schedule || timestamp === undefined)
    return 1;
  return isPeakPricingPeriod(schedule, timestamp) ? 1 : schedule.offPeakMultiplier;
}
function calculateUsageCost(cost, usage, timestamp) {
  const orchestration = usage.orchestration;
  const promptInputTokens = usage.input + usage.cacheRead + usage.cacheWrite + (orchestration?.input ?? 0) + (orchestration?.cacheRead ?? 0);
  const pricingTimestamp = cost.timeBased ? timestamp ?? Date.now() : undefined;
  const rates = resolveTokenCost(cost, promptInputTokens, pricingTimestamp);
  const multiplier = timeBasedMultiplier(cost.timeBased, pricingTimestamp);
  usage.cost.input = rates.input / 1e6 * (usage.input + (orchestration?.input ?? 0)) * multiplier;
  usage.cost.output = rates.output / 1e6 * (usage.output + (orchestration?.output ?? 0)) * multiplier;
  usage.cost.cacheRead = rates.cacheRead / 1e6 * (usage.cacheRead + (orchestration?.cacheRead ?? 0)) * multiplier;
  usage.cost.cacheWrite = cacheWriteCost(rates, usage) * multiplier;
  usage.cost.total = usage.cost.input + usage.cost.output + usage.cost.cacheRead + usage.cost.cacheWrite;
  return usage.cost;
}
function cacheWriteCost(rates, usage) {
  const rate5m = rates.cacheWrite / 1e6;
  const cttl = usage.cttl;
  if (!cttl)
    return rate5m * usage.cacheWrite;
  const fiveMinute = cttl.ephemeral5m ?? 0;
  const oneHour = cttl.ephemeral1h ?? 0;
  const residual = Math.max(0, usage.cacheWrite - fiveMinute - oneHour);
  return rate5m * (fiveMinute + residual) + rates.input * 2 / 1e6 * oneHour;
}

// src/subagent-usage-pricing.ts
var SUBAGENT_USAGE_SNAPSHOT_ENV = "MAGIC_CONTEXT_SUBAGENT_USAGE_SNAPSHOT";
function appendUsagePricingSnapshot(message, registry) {
  const path = process.env[SUBAGENT_USAGE_SNAPSHOT_ENV];
  if (!path || !message || typeof message !== "object")
    return;
  const assistant = message;
  if (assistant.role !== "assistant" || !assistant.usage || typeof assistant.usage !== "object")
    return;
  const usage = assistant.usage;
  const provider = typeof assistant.provider === "string" ? assistant.provider : "";
  const model = typeof assistant.model === "string" ? assistant.model : "";
  const available = registry?.getAvailable?.("all") ?? [];
  const registered = available.find((item) => {
    const candidate = item;
    return candidate.provider === provider && candidate.id === model;
  });
  const number = (value) => typeof value === "number" && Number.isFinite(value) ? value : 0;
  const pricing = registered?.cost ? JSON.parse(JSON.stringify(registered.cost)) : null;
  let estimatedCost = null;
  if (pricing) {
    const calculationUsage = {
      ...usage,
      input: number(usage.input),
      output: number(usage.output),
      cacheRead: number(usage.cacheRead),
      cacheWrite: number(usage.cacheWrite),
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
    };
    const result = calculateUsageCost(pricing, calculationUsage, typeof assistant.timestamp === "number" ? assistant.timestamp : undefined);
    if (Number.isFinite(result.total))
      estimatedCost = result.total;
  }
  const entry = {
    provider,
    model,
    usage: {
      input: number(usage.input),
      output: number(usage.output),
      cacheRead: number(usage.cacheRead),
      cacheWrite: number(usage.cacheWrite),
      totalTokens: number(usage.totalTokens),
      ...typeof usage.reasoningTokens === "number" ? { reasoningTokens: usage.reasoningTokens } : {}
    },
    pricing,
    estimatedCost
  };
  appendFileSync(path, `${JSON.stringify(entry)}
`, {
    encoding: "utf8",
    mode: 384
  });
}
function consumeUsagePricingSnapshots(path) {
  try {
    return readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    return [];
  } finally {
    try {
      unlinkSync(path);
    } catch {}
  }
}

export { SUBAGENT_USAGE_SNAPSHOT_ENV, appendUsagePricingSnapshot, consumeUsagePricingSnapshots };
