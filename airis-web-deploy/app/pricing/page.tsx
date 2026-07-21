import Link from "next/link";
import { ArrowRight, Check, X, HelpCircle, Sparkles, Users, Building2, Heart } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollReveal } from "@/components/scroll-reveal";

const plans = [
  {
    name: "Free",
    description: "For individual developers getting started",
    icon: Heart,
    price: "$0",
    period: "forever",
    cta: "Get Started",
    href: "/download",
    popular: false,
    features: [
      { text: "CLI access to all AI providers", included: true },
      { text: "Session management (up to 10 sessions)", included: true },
      { text: "Basic command execution", included: true },
      { text: "Community support", included: true },
      { text: "Git integration", included: true },
      { text: "Up to 3 AI agents", included: true },
      { text: "Workflow automation (5 workflows)", included: false },
      { text: "Web IDE access", included: false },
      { text: "API access", included: false },
      { text: "Team collaboration", included: false },
      { text: "Priority support", included: false },
      { text: "Custom integrations", included: false },
    ],
  },
  {
    name: "Pro",
    description: "For professional developers",
    icon: Sparkles,
    price: "$12",
    period: "/month",
    cta: "Subscribe",
    href: "#",
    popular: true,
    features: [
      { text: "Everything in Free", included: true },
      { text: "Unlimited sessions", included: true },
      { text: "Advanced command execution", included: true },
      { text: "Web IDE access", included: true },
      { text: "Up to 20 AI agents", included: true },
      { text: "Unlimited workflows", included: true },
      { text: "API access (1,000 req/day)", included: true },
      { text: "Custom system prompts", included: true },
      { text: "Voice assistant mode", included: true },
      { text: "Priority email support", included: true },
      { text: "Extended memory storage", included: true },
      { text: "Advanced analytics", included: false },
    ],
  },
  {
    name: "Team",
    description: "For teams and organizations",
    icon: Users,
    price: "$29",
    period: "/user/month",
    cta: "Subscribe",
    href: "#",
    popular: false,
    features: [
      { text: "Everything in Pro", included: true },
      { text: "Unlimited AI agents", included: true },
      { text: "Team workspaces", included: true },
      { text: "Role-based access control", included: true },
      { text: "Shared workflow library", included: true },
      { text: "Team billing", included: true },
      { text: "API access (10,000 req/day)", included: true },
      { text: "5GB shared storage", included: true },
      { text: "Priority chat support", included: true },
      { text: "Advanced analytics dashboard", included: true },
      { text: "Custom integrations", included: true },
      { text: "SSO / SAML", included: false },
    ],
  },
  {
    name: "Enterprise",
    description: "For large-scale deployments",
    icon: Building2,
    price: "Custom",
    period: "",
    cta: "Contact Sales",
    href: "#",
    popular: false,
    features: [
      { text: "Everything in Team", included: true },
      { text: "Unlimited everything", included: true },
      { text: "On-premise deployment", included: true },
      { text: "Custom SLAs", included: true },
      { text: "Dedicated support engineer", included: true },
      { text: "SSO / SAML / OIDC", included: true },
      { text: "Audit logging", included: true },
      { text: "Custom contract terms", included: true },
      { text: "24/7 phone & email support", included: true },
      { text: "Custom integrations development", included: true },
      { text: "Training & onboarding", included: true },
      { text: "White-labeling options", included: true },
    ],
  },
];

const faqs = [
  { q: "Can I use AIRIS without a subscription?", a: "Yes! AIRIS CLI is free and open source. The Free plan includes CLI access to all AI providers, session management, and basic features. Paid plans add the Web IDE, advanced workflows, team features, and API access." },
  { q: "Do I need my own API keys?", a: "Yes. AIRIS uses your own API keys for AI providers. You set your keys as environment variables and AIRIS routes requests through them. This gives you full control over which models you use and how much you spend." },
  { q: "Can I switch plans anytime?", a: "Absolutely. You can upgrade or downgrade your plan at any time. When upgrading, you get immediate access to new features. When downgrading, your plan changes at the next billing cycle." },
  { q: "Is there a free trial for paid plans?", a: "Yes, Pro and Team plans come with a 14-day free trial. No credit card required to start your trial." },
  { q: "What payment methods do you accept?", a: "We accept credit/debit cards, PayPal, and UPI. Enterprise plans can also be invoiced with NET-30 terms." },
  { q: "Is my data secure?", a: "AIRIS runs locally on your machine. Your code, API keys, and data never leave your environment unless you explicitly use cloud features. Enterprise plans offer on-premise deployment options." },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main id="main-content">
        {/* Hero */}
        <section className="relative isolate overflow-hidden border-b border-border/50 px-4 pb-16 pt-20 sm:pb-24 sm:pt-24 lg:px-8">
          <div className="bg-grid absolute inset-0 -z-10 opacity-60" aria-hidden />
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="text-balance text-[clamp(2.25rem,5vw,4rem)] font-semibold tracking-[-0.03em] leading-[1.1]">
              Simple, transparent{" "}
              <span className="gradient-text">pricing</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Start free. No credit card required. Upgrade when you need more power.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/50 px-3.5 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              All plans include CLI access free & open source
            </div>
          </div>
        </section>

        {/* Plans */}
        <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 lg:grid-cols-4">
              {plans.map((plan) => (
                <ScrollReveal key={plan.name}>
                  <Card className={`glass-card hover-lift relative flex h-full flex-col ${
                    plan.popular ? "border-blue-400/40 shadow-lg shadow-blue-500/10" : ""
                  }`}>
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-blue-600 text-white border-0 px-4 py-1 text-xs">Most Popular</Badge>
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className={`grid h-10 w-10 place-items-center rounded-xl ${
                          plan.popular ? "bg-blue-400/10 text-blue-400" : "bg-secondary text-muted-foreground"
                        }`}>
                          <plan.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{plan.name}</CardTitle>
                          <CardDescription>{plan.description}</CardDescription>
                        </div>
                      </div>
                      <div className="mt-4">
                        <span className="text-3xl font-bold">{plan.price}</span>
                        {plan.period && (
                          <span className="ml-1 text-sm text-muted-foreground">{plan.period}</span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col">
                      <ul className="flex-1 space-y-3">
                        {plan.features.map((feat) => (
                          <li key={feat.text} className="flex items-start gap-3 text-sm">
                            {feat.included ? (
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                            ) : (
                              <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                            )}
                            <span className={feat.included ? "text-foreground" : "text-muted-foreground/50"}>{feat.text}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        asChild
                        size="lg"
                        className={`mt-6 w-full ${plan.popular ? "" : "variant-outline"}`}
                        variant={plan.popular ? "primary" : "outline"}
                      >
                        <Link href={plan.href}>
                          {plan.cta} {plan.popular && <ArrowRight className="h-4 w-4" />}
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-y border-border/50 bg-secondary/30 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Frequently asked questions</h2>
              <p className="mt-3 text-muted-foreground">Everything you need to know about AIRIS pricing and plans.</p>
            </div>
            <div className="mt-10 space-y-4">
              {faqs.map((faq) => (
                <details key={faq.q} className="group rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm">
                  <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-medium">
                    {faq.q}
                    <HelpCircle className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-border/50 px-5 py-4 text-sm text-muted-foreground">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Start building with AIRIS today
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Join thousands of developers using AIRIS. Free plan includes full CLI access.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/download">
                  Get Started Free <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
