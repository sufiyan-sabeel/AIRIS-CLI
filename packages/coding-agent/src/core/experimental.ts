export function areExperimentalFeaturesEnabled(): boolean {
	return process.env.AIRIS_EXPERIMENTAL === "1";
}
