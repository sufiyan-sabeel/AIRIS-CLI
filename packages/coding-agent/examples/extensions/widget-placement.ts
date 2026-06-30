import type { ExtensionAPI } from "@sufiyan-sabeel/airis-cli";

export default function widgetPlacementExtension(airis: ExtensionAPI) {
	airis.on("session_start", (_event, ctx) => {
		if (!ctx.hasUI) return;
		ctx.ui.setWidget("widget-above", ["Above editor widget"]);
		ctx.ui.setWidget("widget-below", ["Below editor widget"], { placement: "belowEditor" });
	});
}
