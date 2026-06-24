import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AIRIS CLI — AI Coding Agent in Your Terminal",
    template: "%s | AIRIS CLI",
  },
  description:
    "Artificial Intelligence Responsive Integrated System. A local-first AI coding agent that runs in your terminal with 25+ providers, file operations, and session management.",
  keywords: [
    "AI coding agent",
    "CLI tool",
    "terminal AI",
    "code assistant",
    "AIRIS",
    "command line",
    "developer tools",
    "LLM",
    "coding",
  ],
  authors: [{ name: "Umaiz Sufiyan" }],
  creator: "Umaiz Sufiyan",
  metadataBase: new URL("https://sufiyan-sabeel.github.io"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://sufiyan-sabeel.github.io/AIRIS-CLI/",
    title: "AIRIS CLI — AI Coding Agent in Your Terminal",
    description:
      "Artificial Intelligence Responsive Integrated System. A local-first AI coding agent that runs in your terminal with 25+ providers, file operations, and session management.",
    siteName: "AIRIS CLI",
    images: [
      {
        url: "/AIRIS-CLI/og.png",
        width: 1200,
        height: 630,
        alt: "AIRIS CLI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AIRIS CLI — AI Coding Agent in Your Terminal",
    description:
      "Artificial Intelligence Responsive Integrated System. A local-first AI coding agent that runs in your terminal.",
    images: ["/AIRIS-CLI/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/AIRIS-CLI/favicon.ico",
    shortcut: "/AIRIS-CLI/favicon-16x16.png",
    apple: "/AIRIS-CLI/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
