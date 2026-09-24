/** Usage-only entry for OMP children without Magic Context tools. */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { log } from "@magic-context/core/shared/logger";
import { appendUsagePricingSnapshot } from "./subagent-usage-pricing";

export default function subagentUsageExtension(pi: ExtensionAPI): void {
	pi.on("message_end", (event, ctx) => {
		try {
			appendUsagePricingSnapshot(
				event.message,
				(ctx as { modelRegistry?: unknown }).modelRegistry,
			);
		} catch (error) {
			log(
				`[pi-subagent] usage snapshot failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	});
}
