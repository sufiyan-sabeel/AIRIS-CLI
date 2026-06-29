import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

const title = "AIRIS CLI — Modern AI command-line development assistant";
const description = "AIRIS CLI is a local-first AI coding agent for the terminal by Umaiz Sufiyan and KageOS, with file tools, shell execution, sessions, verified autonomy, and ship workflows.";

export const metadata: Metadata = {
  metadataBase: new URL("https://sufiyan-sabeel.github.io/AIRIS-CLI/"),
  title: { default: title, template: "%s | AIRIS CLI" },
  description,
  applicationName: "AIRIS CLI",
  authors: [{ name: "Umaiz Sufiyan" }],
  creator: "Umaiz Sufiyan",
  publisher: "KageOS",
  keywords: ["AIRIS CLI", "AI coding agent", "terminal assistant", "command-line development assistant", "KageOS", "Umaiz Sufiyan"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", title, description, url: "/", siteName: "AIRIS CLI" },
  twitter: { card: "summary_large_image", title, description },
  icons: { icon: "/airis-logo.svg", shortcut: "/airis-logo.svg", apple: "/airis-logo.svg" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large", "max-video-preview": -1 } },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, colorScheme: "dark light", themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#0b0d12" }, { media: "(prefers-color-scheme: light)", color: "#ffffff" }] };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
