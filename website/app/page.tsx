import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { Features } from "@/components/features";
import { TerminalDemo } from "@/components/terminal-demo";
import { InstallCommand } from "@/components/install-command";
import { Commands } from "@/components/commands";
import { Workflow } from "@/components/workflow";
import { Installation } from "@/components/installation";
import { Providers } from "@/components/providers";
import { FAQ } from "@/components/faq";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <TerminalDemo />
        <InstallCommand />
        <Commands />
        <Workflow />
        <Installation />
        <Providers />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
