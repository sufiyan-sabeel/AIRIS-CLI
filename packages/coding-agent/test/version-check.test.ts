import { afterEach, describe, expect, it, vi } from "vitest";
import {
	checkForNewAirisVersion,
	comparePackageVersions,
	getLatestAirisRelease,
	getLatestAirisVersion,
	isNewerPackageVersion,
} from "../src/utils/version-check.ts";

const originalSkipVersionCheck = process.env.AIRIS_SKIP_VERSION_CHECK;
const originalOffline = process.env.AIRIS_OFFLINE;

afterEach(() => {
	vi.unstubAllGlobals();
	if (originalSkipVersionCheck === undefined) {
		delete process.env.AIRIS_SKIP_VERSION_CHECK;
	} else {
		process.env.AIRIS_SKIP_VERSION_CHECK = originalSkipVersionCheck;
	}
	delete process.env.AIRIS_SKIP_VERSION_CHECK;
	if (originalOffline === undefined) {
		delete process.env.AIRIS_OFFLINE;
	} else {
		process.env.AIRIS_OFFLINE = originalOffline;
	}
	delete process.env.AIRIS_OFFLINE;
});

describe("version checks", () => {
	it("compares package versions", () => {
		expect(comparePackageVersions("0.70.6", "0.70.5")).toBeGreaterThan(0);
		expect(comparePackageVersions("0.70.5", "0.70.5")).toBe(0);
		expect(comparePackageVersions("0.70.4", "0.70.5")).toBeLessThan(0);
		expect(comparePackageVersions("5.0.0-beta.20", "5.0.0-beta.9")).toBeGreaterThan(0);
		expect(isNewerPackageVersion("0.70.5", "0.70.5")).toBe(false);
		expect(isNewerPackageVersion("0.70.6", "0.70.5")).toBe(true);
	});

	it("returns only newer versions", async () => {
		const fetchMock = vi.fn(async () => Response.json({ tag_name: "v1.2.3" }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(checkForNewAirisVersion("1.2.3")).resolves.toBeUndefined();
		await expect(checkForNewAirisVersion("1.2.2")).resolves.toEqual({ version: "1.2.3" });
	});

	it("uses the AIRIS GitHub release api with an AIRIS user agent", async () => {
		const fetchMock = vi.fn(async () => Response.json({ tag_name: "v1.2.4" }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(getLatestAirisVersion("1.2.3")).resolves.toBe("1.2.4");
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.github.com/repos/sufiyan-sabeel/AIRIS-CLI/releases/latest",
			expect.objectContaining({
				headers: expect.objectContaining({
					"User-Agent": expect.stringMatching(/^airis\/1\.2\.3 /),
					accept: "application/json",
				}),
			}),
		);
	});

	it("returns the active package metadata from the version check api", async () => {
		const fetchMock = vi.fn(async () =>
			Response.json({
				name: "@sufiyan-sabeel/airis-cli",
				tag_name: "v1.2.4",
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(getLatestAirisRelease("1.2.3")).resolves.toEqual({
			packageName: "@sufiyan-sabeel/airis-cli",
			version: "1.2.4",
		});
	});

	it("returns update notes from the version check api", async () => {
		const fetchMock = vi.fn(async () => Response.json({ body: " **Read this** ", tag_name: "v1.2.4" }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(getLatestAirisRelease("1.2.3")).resolves.toEqual({ note: "**Read this**", version: "1.2.4" });
	});

	it("skips api calls when version checks are disabled", async () => {
		process.env.AIRIS_SKIP_VERSION_CHECK = "1";
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await expect(getLatestAirisVersion("1.2.3")).resolves.toBeUndefined();
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
