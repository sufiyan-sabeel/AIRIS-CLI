import type { LoadExtensionsResult, ProjectTrustContext } from "./extensions/types.ts";
import { type AppMode, resolveProjectTrusted } from "./project-trust.ts";
import type { DefaultProjectTrust } from "./settings-manager.ts";
import { hasTrustRequiringProjectResources, type ProjectTrustStore } from "./trust-manager.ts";

export interface AirisTrustOnboardingOptions {
	cwd: string;
	trustStore: ProjectTrustStore;
	trustOverride?: boolean;
	defaultProjectTrust?: DefaultProjectTrust;
	requireTrust?: boolean;
	extensionsResult?: LoadExtensionsResult;
	projectTrustContext: ProjectTrustContext;
	onExtensionError?: (message: string) => void;
}

export interface AirisTrustOnboardingSummary {
	cwd: string;
	requiresTrust: boolean;
	alreadyDecided: boolean;
}

export function describeAirisTrustOnboarding(cwd: string, trustStore: ProjectTrustStore): AirisTrustOnboardingSummary {
	return {
		cwd,
		requiresTrust: hasTrustRequiringProjectResources(cwd),
		alreadyDecided: trustStore.get(cwd) !== null,
	};
}

export function formatAirisTrustMeaning(cwd: string): string {
	return [
		"Trust this AIRIS project folder?",
		"",
		`Folder: ${cwd}`,
		"",
		"Trusted means:",
		"  - AIRIS can read and edit files in this repository",
		"  - AIRIS can run safe checks and project-local commands",
		"  - AIRIS can load project-local settings, skills, prompts, themes, and extensions",
		"  - AIRIS will still ask before risky or destructive actions",
	].join("\n");
}

export async function resolveAirisTrustOnboarding(options: AirisTrustOnboardingOptions): Promise<boolean> {
	return resolveProjectTrusted(options);
}

export function getAirisTrustPromptMode(appMode: AppMode, isMetadataCommand: boolean): AppMode {
	return isMetadataCommand ? "print" : appMode;
}
