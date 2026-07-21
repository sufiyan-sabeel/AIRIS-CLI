import Link from "next/link";
import { ArrowRight, Smartphone, Cpu, Eye, Terminal, Bluetooth, Wifi, Zap, Bot, Shield, Monitor, Settings, Download, Play } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/section-header";
import { ScrollReveal, StaggerChildren, StaggerItem } from "@/components/scroll-reveal";
import { CodeBlock } from "@/components/code-block";

export default function AndroidAutomationPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main id="main-content">
        <section className="relative isolate overflow-hidden border-b border-border/50 px-4 pb-16 pt-20 sm:pb-24 sm:pt-24 lg:px-8">
          <div className="bg-grid absolute inset-0 -z-10 opacity-60" aria-hidden />
          <div className="absolute left-1/4 top-12 -z-10 h-72 w-72 rounded-full bg-emerald-500/8 blur-3xl" aria-hidden />
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-3.5 py-1 text-xs font-medium text-muted-foreground">
              <Smartphone className="h-3 w-3 text-emerald-400" />
              <span>Android Automation Platform</span>
            </div>
            <h1 className="text-balance text-[clamp(2.25rem,5vw,4rem)] font-semibold tracking-[-0.03em] leading-[1.1]">
              Control Android devices with{" "}
              <span className="gradient-text">AI-powered automation</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Connect, control, and automate Android devices using ADB, Termux API, and AI agents.
              Test apps, automate workflows, and manage devices at scale.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/download">
                  Get Started <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Capabilities"
              title="Full Android device control"
              description="AIRIS provides comprehensive Android device automation through ADB and Termux."
            />
            <StaggerChildren staggerDelay={0.06} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Smartphone, title: "Device Connection", description: "Connect devices via USB, Wi-Fi, or TCP/IP" },
                { icon: Terminal, title: "ADB Shell Access", description: "Full ADB command execution and scripting" },
                { icon: Eye, title: "Screen Capture & Analysis", description: "Capture screenshots and analyze with AI vision" },
                { icon: Monitor, title: "UI Automation", description: "Tap, swipe, type, and interact with UI elements" },
                { icon: Bot, title: "AI Agent Control", description: "AI agents that can see and control your device" },
                { icon: Wifi, title: "Wireless Debugging", description: "Connect and control devices over Wi-Fi" },
                { icon: Bluetooth, title: "Bluetooth Automation", description: "Manage Bluetooth connections and data" },
                { icon: Cpu, title: "Device Info & Monitoring", description: "Battery, CPU, memory, and sensor data" },
                { icon: Shield, title: "App Management", description: "Install, uninstall, and manage applications" },
              ].map((item) => (
                <StaggerItem key={item.title}>
                  <Card className="glass-card hover-lift h-full">
                    <CardHeader>
                      <item.icon className="mb-1 h-5 w-5 text-emerald-400" />
                      <CardTitle className="text-sm">{item.title}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </StaggerItem>
              ))}
            </StaggerChildren>
          </div>
        </section>

        {/* Code Example */}
        <section className="border-y border-border/50 bg-secondary/30 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2 lg:items-center">
            <ScrollReveal variant="slide-left">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border/60 bg-secondary/60 px-3 py-1 text-xs font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
                Example
              </span>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                AI-powered device automation
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                Describe what you want to do, and AIRIS handles the ADB commands automatically.
              </p>
            </ScrollReveal>
            <ScrollReveal variant="slide-right">
              <CodeBlock code={`# Connect device
adb connect 192.168.1.100:5555

# With AIRIS AI:
"Open WhatsApp, send a message to John saying I'll be there in 10 minutes"

# AIRIS executes:
adb shell am start -n com.whatsapp/.MainActivity
# AI reads screen, finds contact, types message, sends

# Screen analysis with AIRIS:
"Analyze the current screen and tell me what app is open"`} />
            </ScrollReveal>
          </div>
        </section>

        {/* Use Cases */}
        <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionHeader
              eyebrow="Use Cases"
              title="What can you automate?"
              description="Endless possibilities for Android automation with AIRIS."
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { title: "App Testing", description: "Automate UI testing across devices" },
                { title: "Social Media", description: "Schedule and post content automatically" },
                { title: "Data Collection", description: "Extract data from apps and websites" },
                { title: "Device Farm", description: "Manage multiple devices from one interface" },
                { title: "Notifications", description: "Forward and respond to notifications" },
                { title: "Backup & Sync", description: "Automated device backup workflows" },
                { title: "Monitoring", description: "Watch device health and performance" },
                { title: "Smart Home", description: "Control smart home through device" },
              ].map((item) => (
                <ScrollReveal key={item.title}>
                  <Card className="glass-card hover-lift shine-card h-full">
                    <CardHeader>
                      <CardTitle className="text-sm">{item.title}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border/50 bg-secondary/30 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Smartphone className="mx-auto h-10 w-10 text-emerald-400" />
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Start automating your Android devices
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Connect your first device and let AI handle the rest.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link href="/download">
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
