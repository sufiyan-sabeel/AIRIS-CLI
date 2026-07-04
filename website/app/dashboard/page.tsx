import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import {
	ArrowRight,
	BarChart3,
	BookOpen,
	Box,
	Code2,
	ExternalLink,
	FileCode2,
	GitCommit,
	GitFork,
	GitPullRequest,
	Github,
	Lightbulb,
	Package,
	RefreshCw,
	Terminal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Force static generation at build time for static export
export const dynamic = "force-static";

interface DashboardData {
	generatedAt: string;
	date: string;
	dailyFact: {
		fact: string;
		index: number;
		total: number;
	};
	analysis: {
		packages: number;
		packageNames: string[];
		tsSourceFiles: number;
		tsxComponents: number;
		goModules: number;
		scriptFiles: number;
		totalSourceLines: number;
		githubWorkflows: number;
		markdownDocs: number;
	};
	codeBreakdown: Array<{
		label: string;
		count: number;
		color: string;
	}>;
}

function loadDashboardData(): DashboardData | null {
	try {
		const path = join(process.cwd(), "public", "dashboard-data.json");
		if (!existsSync(path)) return null;
		const raw = readFileSync(path, "utf-8");
		return JSON.parse(raw) as DashboardData;
	} catch {
		return null;
	}
}

const repoUrl = "https://github.com/sufiyan-sabeel/AIRIS-CLI";

function StatCard({
	icon: Icon,
	label,
	value,
	sub,
	color,
}: { icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string }) {
	return (
		<Card className="glass-card hover-lift shine-card">
			<CardHeader className="flex flex-row items-center gap-3 pb-2">
				<div
					className="grid h-10 w-10 place-items-center rounded-xl border"
					style={{ borderColor: color ? `${color}40` : undefined }}
				>
					<Icon className="h-5 w-5" style={{ color }} />
				</div>
				<div>
					<CardTitle className="text-2xl font-semibold">{value}</CardTitle>
					<CardDescription>{label}</CardDescription>
				</div>
			</CardHeader>
			{sub && (
				<CardContent>
					<p className="text-xs text-muted-foreground">{sub}</p>
				</CardContent>
			)}
		</Card>
	);
}

function MiniBarChart({ data }: { data: DashboardData["codeBreakdown"] }) {
	const max = Math.max(...data.map((d) => d.count), 1);
	return (
		<div className="space-y-3">
			{data.map((item) => (
				<div key={item.label} className="space-y-1">
					<div className="flex items-center justify-between text-sm">
						<span>{item.label}</span>
						<span className="font-medium tabular-nums text-muted-foreground">{item.count.toLocaleString()}</span>
					</div>
					<div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
						<div
							className="h-full rounded-full transition-all duration-500"
							style={{ width: `${(item.count / max) * 100}%`, backgroundColor: item.color }}
						/>
					</div>
				</div>
			))}
		</div>
	);
}

function PackageGrid({ names }: { names: string[] }) {
	return (
		<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
			{names.map((name) => (
				<div key={name} className="hover-lift flex items-center gap-2 rounded-xl border border-border p-3 text-sm">
					<Package className="h-4 w-4 shrink-0 text-blue-500" />
					<span className="truncate font-mono text-xs">{name}</span>
				</div>
			))}
		</div>
	);
}

function DailyFactCard({ fact }: { fact: DashboardData["dailyFact"] }) {
	return (
		<Card className="glass-card relative overflow-hidden border-blue-400/20">
			<div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl" aria-hidden />
			<CardHeader>
				<div className="flex items-center gap-2">
					<Lightbulb className="h-5 w-5 text-amber-400" />
					<Badge className="border-amber-400/30 text-amber-500">
						Daily Fact #{fact.index + 1} of {fact.total}
					</Badge>
				</div>
				<CardTitle className="mt-4 text-xl leading-relaxed">{fact.fact}</CardTitle>
				<CardDescription className="mt-2">
					A daily dose of AIRIS CLI knowledge — refreshed every 24 hours.
				</CardDescription>
			</CardHeader>
		</Card>
	);
}

export default function DashboardPage() {
	const data = loadDashboardData();

	return (
		<div className="min-h-screen bg-background text-foreground">
			{/* Header */}
			<header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
				<div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
					<Link href="/" className="flex items-center gap-2 text-sm font-medium">
						<Terminal className="h-4 w-4" />
						AIRIS CLI
					</Link>
					<nav className="flex items-center gap-4 text-sm" aria-label="Secondary navigation">
						<Link href="/" className="text-muted-foreground transition-colors hover:text-foreground">
							Home
						</Link>
						<span className="text-muted-foreground/40">/</span>
						<span className="font-medium">Dashboard</span>
					</nav>
				</div>
			</header>

			<main className="px-4 py-10 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-7xl">
					{/* Page header */}
					<div className="mb-10">
						<Badge className="mb-3">Live analysis</Badge>
						<h1 className="text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Project Dashboard</h1>
						<p className="mt-2 text-muted-foreground">
							Repository analysis, daily facts, and code statistics for the AIRIS CLI project.
							{data && (
								<span className="block text-xs">
									Last updated: {new Date(data.generatedAt).toLocaleString()}
								</span>
							)}
						</p>
					</div>

					{/* Daily Fact */}
					{data && (
						<section className="mb-12">
							<DailyFactCard fact={data.dailyFact} />
						</section>
					)}

					{/* Stats grid */}
					<section className="mb-12">
						<h2 className="mb-6 text-xl font-semibold">Repository Analysis</h2>
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							{data && (
								<>
									<StatCard icon={Box} label="Packages" value={data.analysis.packages} color="#3178c6" />
									<StatCard
										icon={Code2}
										label="Source Lines"
										value={data.analysis.totalSourceLines.toLocaleString()}
										color="#06b6d4"
									/>
									<StatCard icon={FileCode2} label="TS Source Files" value={data.analysis.tsSourceFiles} color="#3178c6" />
									<StatCard
										icon={BookOpen}
										label="Markdown Docs"
										value={data.analysis.markdownDocs}
										color="#8b5cf6"
									/>
									<StatCard icon={Terminal} label="Go Modules" value={data.analysis.goModules} color="#00ADD8" />
									<StatCard
										icon={RefreshCw}
										label="GitHub Workflows"
										value={data.analysis.githubWorkflows}
										color="#f59e0b"
									/>
									<StatCard icon={Code2} label="Scripts" value={data.analysis.scriptFiles} color="#f0db4f" />
									<StatCard icon={Box} label="TSX Components" value={data.analysis.tsxComponents} color="#06b6d4" />
								</>
							)}
							{!data && (
								<div className="col-span-full">
									<Card className="glass-card">
										<CardHeader>
											<CardTitle>Dashboard data not available</CardTitle>
											<CardDescription>
												Run <code>node scripts/generate-daily-facts.mjs</code> from the repo root to generate dashboard
												data, then rebuild the site.
											</CardDescription>
										</CardHeader>
									</Card>
								</div>
							)}
						</div>
					</section>

					{/* Code breakdown chart */}
					{data && (
						<section className="mb-12 grid gap-8 lg:grid-cols-2">
							<Card className="glass-card">
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<BarChart3 className="h-5 w-5 text-blue-500" />
										Code Breakdown
									</CardTitle>
									<CardDescription>File counts by type across the entire repository</CardDescription>
								</CardHeader>
								<CardContent>
									<MiniBarChart data={data.codeBreakdown} />
								</CardContent>
							</Card>

							<Card className="glass-card">
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<Package className="h-5 w-5 text-blue-500" />
										Packages
									</CardTitle>
									<CardDescription>All workspace packages in the monorepo</CardDescription>
								</CardHeader>
								<CardContent>
									<PackageGrid names={data.analysis.packageNames} />
								</CardContent>
							</Card>
						</section>
					)}

					{/* GitHub section */}
					<section className="mb-12">
						<Card className="glass-card">
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Github className="h-5 w-5" />
									GitHub Repository
								</CardTitle>
								<CardDescription>Quick links and real-time stats for the AIRIS CLI repository</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
									<a
										href={repoUrl}
										target="_blank"
										rel="noreferrer"
										className="hover-lift flex items-center gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-secondary"
									>
										<Github className="h-5 w-5" />
										<div>
											<div className="text-sm font-medium">Repository</div>
											<div className="text-xs text-muted-foreground">View source code</div>
										</div>
										<ExternalLink className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
									</a>
									<a
										href={`${repoUrl}/fork`}
										target="_blank"
										rel="noreferrer"
										className="hover-lift flex items-center gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-secondary"
									>
										<GitFork className="h-5 w-5" />
										<div>
											<div className="text-sm font-medium">Fork</div>
											<div className="text-xs text-muted-foreground">Create your own copy</div>
										</div>
										<ExternalLink className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
									</a>
									<a
										href={`${repoUrl}/issues`}
										target="_blank"
										rel="noreferrer"
										className="hover-lift flex items-center gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-secondary"
									>
										<GitPullRequest className="h-5 w-5" />
										<div>
											<div className="text-sm font-medium">Issues</div>
											<div className="text-xs text-muted-foreground">Report bugs & features</div>
										</div>
										<ExternalLink className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
									</a>
									<a
										href={`${repoUrl}/pulse`}
										target="_blank"
										rel="noreferrer"
										className="hover-lift flex items-center gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-secondary"
									>
										<GitCommit className="h-5 w-5" />
										<div>
											<div className="text-sm font-medium">Activity</div>
											<div className="text-xs text-muted-foreground">Recent pulse & commits</div>
										</div>
										<ExternalLink className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
									</a>
								</div>
							</CardContent>
						</Card>
					</section>

					{/* Back link */}
					<div className="text-center">
						<Button asChild variant="outline">
							<Link href="/">
								<Terminal className="h-4 w-4" />
								Back to Home
								<ArrowRight className="h-4 w-4" />
							</Link>
						</Button>
					</div>
				</div>
			</main>

			{/* Footer */}
			<footer className="border-t border-border/70 px-4 py-8 sm:px-6 lg:px-8">
				<div className="mx-auto flex max-w-7xl flex-col items-center gap-4 text-center text-sm text-muted-foreground md:flex-row md:justify-between">
					<p>AIRIS CLI Dashboard — analysis generated from repository source.</p>
					<div className="flex gap-4">
						<a href={repoUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">
							GitHub
						</a>
						<Link href="/" className="hover:text-foreground">
							Home
						</Link>
					</div>
				</div>
			</footer>
		</div>
	);
}
