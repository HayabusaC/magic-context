import {
  log
} from "./index-83wwtw1q.js";
import {
  appendUsagePricingSnapshot
} from "./index-v6cfsdk5.js";

// src/subagent-usage-entry.ts
function subagentUsageExtension(pi) {
  pi.on("message_end", (event, ctx) => {
    try {
      appendUsagePricingSnapshot(event.message, ctx.modelRegistry);
    } catch (error) {
      log(`[pi-subagent] usage snapshot failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}
export {
  subagentUsageExtension as default
};
