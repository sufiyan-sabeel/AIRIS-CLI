export function getAirisUserAgent(version: string): string {
	const runtime = process.versions.bun ? `bun/${process.versions.bun}` : `node/${process.version}`;
	return `airis/${version} (${process.platform}; ${runtime}; ${process.arch})`;
}
