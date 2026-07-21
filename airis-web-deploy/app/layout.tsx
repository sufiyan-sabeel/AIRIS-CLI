import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import { ScrollProgress } from "@/components/scroll-progress";
import { SmoothScrollProvider } from "@/components/smooth-scroll";
import { MobileBottomNav } from "@/components/mobile-nav";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  preload: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  preload: true,
});

const title = "AIRIS — Next-Generation AI Operating System";
const description =
  "AIRIS is an AI Operating System that combines ChatGPT, Cursor, GitHub, VS Code AI tools, workflow automation, intelligent agents, and system management into one cohesive ecosystem. Built for developers, by developers.";

export const metadata: Metadata = {
  metadataBase: new URL("https://sufiyan-sabeel.github.io/AIRIS-CLI/"),
  title: { default: title, template: "%s | AIRIS" },
  description,
  applicationName: "AIRIS",
  authors: [{ name: "Umaiz Sufiyan" }],
  creator: "Umaiz Sufiyan",
  publisher: "KageOS",
  keywords: [
    "AIRIS",
    "AI Operating System",
    "AI coding agent",
    "terminal assistant",
    "command-line development assistant",
    "KageOS",
    "Umaiz Sufiyan",
    "AI developer tools",
    "terminal AI",
    "open source CLI",
    "workflow automation",
    "AI agents",
    "code editor",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title: "AIRIS — AI-Powered Operating System for Development",
    description,
    url: "/",
    siteName: "AIRIS",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "AIRIS — AI-Powered Operating System for Development",
    description,
  },
  icons: {
    icon: "/airis-logo.svg",
    shortcut: "/airis-logo.svg",
    apple: "/airis-logo.svg",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AIRIS",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Linux, macOS, Windows, Android (Termux), Web",
  description,
  author: {
    "@type": "Person",
    name: "Umaiz Sufiyan",
    affiliation: { "@type": "Organization", name: "KageOS" },
  },
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="font-sans antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:z-[100] focus:m-2 focus:rounded-xl focus:bg-foreground focus:px-4 focus:py-2.5 focus:text-background focus:shadow-lg focus:outline-none"
        >
          Skip to content
        </a>
        <ScrollProgress />
        <Providers>
          <SmoothScrollProvider>
            {children}
            <MobileBottomNav />
          </SmoothScrollProvider>
        </Providers>
      </body>
    </html>
  );
}
