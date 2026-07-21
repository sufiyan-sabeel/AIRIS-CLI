import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { FlickeringGrid } from "@/components/magicui/flickering-grid";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import LoadingScreen from "@/components/loading-screen";
import { siteConfig } from "@/lib/site";
import { BASE_PATH } from "@/lib/env";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  manifest: `${BASE_PATH}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: siteConfig.name,
  },
  keywords: [
    "AIRIS",
    "CLI",
    "AI coding agent",
    "terminal AI",
    "coding assistant",
    "developer tools",
    "open source",
    "KageOS",
  ],
  authors: [{ name: siteConfig.creator }],
  creator: siteConfig.creator,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    creator: "@airiscli",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-video-preview": -1,
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#070a12" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          inter.variable,
          jetbrainsMono.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={0}>
            <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[420px] opacity-70">
              <FlickeringGrid
                className="h-full w-full"
                squareSize={3}
                gridGap={3}
                maxOpacity={0.22}
                style={{
                  maskImage:
                    "linear-gradient(to bottom, black, transparent)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, black, transparent)",
                }}
              />
            </div>
            <div className="pointer-events-none fixed inset-0 -z-10 bg-grid mask-fade-b opacity-40" />
            <LoadingScreen />
            <Navbar />
            <main className="relative z-10">{children}</main>
            <Footer />
            <ServiceWorkerRegister />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
