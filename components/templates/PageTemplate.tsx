/**
 * PageTemplate.tsx — XVII-LLC Design System Reference Template
 *
 * This component defines the canonical layout structure and design
 * patterns for all public marketing pages. Use as a starting point
 * for new pages. Remove sections you don't need; the section order
 * and token usage here are the source of truth.
 *
 * Section anatomy (in order):
 *   1. Hero       — full-viewport dark cockpit hero
 *   2. Stats      — full-bleed metric strip
 *   3. Features   — white-bg content grid
 *   4. Highlight  — dark glass-card feature block
 *   5. CTA        — burgundy call-to-action
 *   6. (Navbar + Footer imported from layout components)
 *
 * Design tokens:
 *   Primary bg (dark)  → bg-space / bg-navy-900 / bg-navy-800
 *   Primary bg (light) → bg-white / bg-silver
 *   Accent CTA         → bg-burgundy-600  (single source of truth — no electric-blue on public pages)
 *   Decorative accent  → text-horizon-blue / border-horizon-blue
 *   Display font       → font-sans (IBM Plex Sans)
 *   Data / labels      → font-mono (IBM Plex Mono)
 */

"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArcGauge,
  CompassRose,
  TelemetryTicker,
  StatusGrid,
} from "@/components/Hero/InstrumentCluster";
import { HUDOverlay } from "@/components/Hero/HUDOverlay";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TemplateSection {
  id: string;
  label: string;
}

export interface PageTemplateProps {
  /** Override the hero headline */
  headline?: React.ReactNode;
  /** Override the hero subheadline */
  subheadline?: string;
  /** Override the hero CTA label */
  ctaLabel?: string;
  /** Override the hero CTA href */
  ctaHref?: string;
  /** Stats to show in the metrics strip */
  stats?: Array<{ value: string; label: string }>;
  /** Feature cards for the features section */
  features?: Array<{ icon: string; title: string; body: string }>;
  /** Highlight cards for the dark glass-card block */
  highlights?: Array<{ tag: string; title: string; body: string }>;
  /** CTA section headline */
  ctaSectionHeadline?: string;
  /** CTA section body */
  ctaSectionBody?: string;
  /** CTA section button label */
  ctaSectionButtonLabel?: string;
}

// ─── Default Data ─────────────────────────────────────────────────────────────

const DEFAULT_STATS = [
  { value: "25+", label: "Years in Service" },
  { value: "500K+", label: "Parts Sourced" },
  { value: "98.7%", label: "On-Time Delivery" },
  { value: "24/7", label: "AOG Support" },
];

const DEFAULT_FEATURES = [
  {
    icon: "✈",
    title: "Global Sourcing",
    body: "Access to certified parts from OEMs, distributors, and surplus markets worldwide. ASA-100 and FAA AC 00-56B certified supply chain.",
  },
  {
    icon: "⚡",
    title: "AOG Response",
    body: "Aircraft-on-ground situations demand immediate action. Our team operates around the clock to get you back in the air.",
  },
  {
    icon: "🛡",
    title: "Quality Assurance",
    body: "Every part traced, documented, and verified. ISO 9001 processes with full traceability from manufacture to delivery.",
  },
  {
    icon: "📦",
    title: "Same-Day Dispatch",
    body: "Miami-based hub enables same-day delivery across the Americas. Overnight options available for all major destinations.",
  },
  {
    icon: "🔧",
    title: "MRO Support",
    body: "Component repair and overhaul coordination through our certified repair station network.",
  },
  {
    icon: "📋",
    title: "Documentation",
    body: "Complete airworthiness documentation, 8130-3 tags, certificates of conformance, and export compliance for every shipment.",
  },
];

const DEFAULT_HIGHLIGHTS = [
  {
    tag: "CAPABILITY",
    title: "End-to-End Parts Sourcing",
    body: "From initial RFQ through delivery, we manage the entire supply chain so your team can focus on operations.",
  },
  {
    tag: "NETWORK",
    title: "Certified Supplier Network",
    body: "Over 200 approved suppliers across 40 countries. Every source audited, approved, and actively monitored.",
  },
  {
    tag: "TECHNOLOGY",
    title: "Real-Time Inventory",
    body: "Live inventory integration with our FlightDeck portal. Search, quote, and track orders in a single dashboard.",
  },
];

// ─── Hero: Topo grid background ───────────────────────────────────────────────

function TopoGrid() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(56,178,172,0.6) 40px)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.018]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent, transparent 79px, rgba(56,178,172,0.6) 80px)",
        }}
      />
      {/* Center cross-hair + concentric rings */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[600px] h-[600px] opacity-[0.04]">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-horizon-blue" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-horizon-blue" />
          {[80, 160, 260, 380].map((r) => (
            <div
              key={r}
              className="absolute rounded-full border border-horizon-blue/40"
              style={{
                width: r * 2,
                height: r * 2,
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }}
            />
          ))}
        </div>
      </div>
      {/* Radial vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, rgba(2,6,23,0.7) 100%)",
        }}
      />
    </div>
  );
}

// ─── Hero: Heading strip (top center) ────────────────────────────────────────

function HeadingStrip() {
  const HDG_BASE = 247;
  const ticks = Array.from({ length: 13 }, (_, i) => (HDG_BASE - 60 + i * 10 + 360) % 360);
  const hdgLabel = (hdg: number) => {
    if (hdg === 0) return "N";
    if (hdg === 90) return "E";
    if (hdg === 180) return "S";
    if (hdg === 270) return "W";
    return String(hdg);
  };
  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-10 flex items-end justify-between px-1 border-b border-horizon-blue/10 overflow-hidden">
      {ticks.map((hdg, i) => {
        const isCurrent = i === 6;
        const isCardinal = hdg % 90 === 0;
        return (
          <div key={hdg} className="flex flex-col items-center gap-0.5">
            {(isCurrent || isCardinal) && (
              <span
                className="font-mono text-[7px]"
                style={{ color: isCurrent ? "#38B2AC" : "rgba(255,255,255,0.3)" }}
              >
                {hdgLabel(hdg)}
              </span>
            )}
            <div
              className={`w-px ${isCurrent ? "h-3 bg-horizon-blue" : isCardinal ? "h-2 bg-white/30" : "h-1 bg-white/15"}`}
            />
          </div>
        );
      })}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-3.5 bg-horizon-blue"
        style={{ boxShadow: "0 0 4px #38B2AC" }}
      />
    </div>
  );
}

// ─── Hero: Altitude tape (right edge) ────────────────────────────────────────

function AltitudeTape() {
  const ticks = Array.from({ length: 9 }, (_, i) => 35000 - (i - 4) * 1000);
  return (
    <div className="absolute right-0 top-1/2 -translate-y-1/2 h-64 w-14 flex flex-col items-end justify-between pr-2 border-r border-horizon-blue/10">
      {ticks.map((alt, i) => (
        <div
          key={alt}
          className={`flex items-center gap-1.5 ${i === 4 ? "opacity-100" : "opacity-30"}`}
        >
          <span
            className="font-mono text-[8px] tracking-wider"
            style={{ color: i === 4 ? "#38B2AC" : "rgba(255,255,255,0.5)" }}
          >
            {(alt / 1000).toFixed(0)}K
          </span>
          <div className={`h-px ${i === 4 ? "w-4 bg-horizon-blue" : "w-2 bg-white/30"}`} />
        </div>
      ))}
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-5 bg-horizon-blue rounded-l"
        style={{ boxShadow: "0 0 6px #38B2AC" }}
      />
    </div>
  );
}

// ─── Hero: Left instrument panel ──────────────────────────────────────────────

function HeroLeftPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="hidden lg:flex flex-col gap-4 w-40 flex-shrink-0"
    >
      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
        <div
          className="w-1 h-3 bg-horizon-blue rounded-full"
          style={{ boxShadow: "0 0 4px #38B2AC" }}
        />
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">
          Operations
        </span>
      </div>
      <div className="flex gap-4 justify-center">
        <ArcGauge
          value={99}
          label="Availability"
          unit="PCT"
          color="#38B2AC"
          size={76}
          delay={0.5}
        />
        <ArcGauge
          value={98}
          label="AOG Response"
          unit="PCT"
          color="#1e4a8d"
          size={76}
          delay={0.65}
        />
      </div>
      <StatusGrid delay={0.9} />
      <TelemetryTicker delay={1.2} />
    </motion.div>
  );
}

// ─── Hero: Right instrument panel ────────────────────────────────────────────

function HeroRightPanel() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="hidden lg:flex flex-col gap-4 w-40 flex-shrink-0"
    >
      <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2">
        <div
          className="w-1 h-3 bg-burgundy-600 rounded-full"
          style={{ boxShadow: "0 0 4px #9c2a3e" }}
        />
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">
          Navigation
        </span>
      </div>
      <div className="flex justify-center">
        <CompassRose heading={247} delay={0.6} />
      </div>
      <div className="border border-white/[0.06] rounded bg-white/[0.02] p-2 space-y-1">
        {[
          { label: "LAT", value: "25°48'31\"N" },
          { label: "LON", value: "80°21'21\"W" },
          { label: "ALT", value: "35,000 FT", color: "#38B2AC" },
          { label: "GS", value: "487 KTS" },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex justify-between items-center">
            <span className="font-mono text-[8px] text-white/25 uppercase tracking-wider">
              {label}
            </span>
            <span
              className="font-mono text-[9px] tracking-wider"
              style={{ color: color ?? "rgba(255,255,255,0.5)" }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
      <div className="border border-white/[0.06] rounded bg-white/[0.02] p-2">
        <div className="font-mono text-[8px] text-white/25 uppercase tracking-widest mb-1.5">
          Active Freq
        </div>
        <div
          className="font-mono text-sm text-horizon-blue tracking-wider"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          121.500
        </div>
        <div className="font-mono text-[8px] text-white/25 mt-0.5">GUARD · EMERGENCY</div>
      </div>
    </motion.div>
  );
}

// ─── Hero: Center display ─────────────────────────────────────────────────────

function HeroCenterDisplay({
  headline,
  subheadline,
  ctaLabel,
  ctaHref,
  scrollY,
}: Pick<PageTemplateProps, "headline" | "subheadline" | "ctaLabel" | "ctaHref"> & {
  scrollY: ReturnType<typeof useScroll>["scrollY"];
}) {
  const textY = useTransform(scrollY, [0, 400], [0, -80]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const isTouchRef = useRef(false);

  useEffect(() => {
    isTouchRef.current = "ontouchstart" in window;
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isTouchRef.current) return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    setMouse({ x: (e.clientX - cx) / cx, y: (e.clientY - cy) / cy });
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  const tiltStyle = isTouchRef.current
    ? {}
    : {
        transform: `perspective(1200px) rotateY(${mouse.x * 3}deg) rotateX(${-mouse.y * 3}deg)`,
        transition: "transform 0.12s ease-out",
      };

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative min-w-0">
      <HeadingStrip />
      <AltitudeTape />

      {/* Glass logo card with HUD overlay */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card p-4 sm:p-6 relative mb-6 pointer-events-none"
        style={tiltStyle}
      >
        <HUDOverlay isActive showStatus />
        {/* Logo placeholder — swap for <Image> when available */}
        <div className="w-full max-w-[min(32rem,80vw)] h-20 flex items-center justify-center">
          <span className="font-sans font-semibold text-3xl sm:text-4xl tracking-tight">
            <span className="text-chrome">GENTHRUST</span>
            <span className="text-aviation-red font-light ml-2">XVII</span>
          </span>
        </div>
      </motion.div>

      {/* Headline + subhead + CTAs */}
      <motion.div style={{ y: textY, opacity }} className="text-center px-4 z-10">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="font-sans text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-3 leading-none"
        >
          {headline ?? (
            <>
              <span className="text-chrome">Precision Aviation</span>
              <span className="text-silver/60 font-light"> Sourcing</span>
            </>
          )}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.48 }}
          className="font-sans text-base sm:text-lg text-silver/50 max-w-md mx-auto mb-7"
        >
          {subheadline ?? "Same day delivery · Competitive pricing · 25+ years AOG expertise"}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-3 justify-center mb-8"
        >
          <a
            href={ctaHref ?? "/contact"}
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-burgundy-600 hover:bg-burgundy-500 text-white font-sans font-medium text-sm tracking-wide rounded transition-all duration-200 shadow-glow-crimson"
          >
            {ctaLabel ?? "Request a Quote"}
            <span className="font-mono text-xs opacity-60">→</span>
          </a>
          <a
            href="/inventory"
            className="inline-flex items-center gap-2 px-7 py-3.5 border border-silver/20 hover:border-silver/40 text-silver/70 hover:text-silver font-sans font-medium text-sm tracking-wide rounded transition-all duration-200 backdrop-blur-sm"
          >
            Browse Inventory
          </a>
        </motion.div>

        {/* Inline stat row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.78 }}
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1"
        >
          {[
            { value: "500K+", label: "Parts Sourced" },
            { value: "98.7%", label: "On-Time Delivery" },
            { value: "24/7", label: "AOG Support" },
          ].map((stat, i, arr) => (
            <span key={stat.label} className="flex items-center gap-x-6">
              <span className="font-mono text-xs text-silver/40 tracking-wider">
                <span className="text-silver/60 font-semibold">{stat.value}</span> {stat.label}
              </span>
              {i < arr.length - 1 && <span className="hidden sm:inline text-silver/15">|</span>}
            </span>
          ))}
        </motion.div>
      </motion.div>

      {/* Scroll chevron */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.0, duration: 0.4 }}
        className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-silver/30"
      >
        <motion.svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="m6 9 6 6 6-6" />
        </motion.svg>
      </motion.div>
    </div>
  );
}

// ─── Section: Hero ────────────────────────────────────────────────────────────

function HeroSection({
  headline,
  subheadline,
  ctaLabel,
  ctaHref,
}: Pick<PageTemplateProps, "headline" | "subheadline" | "ctaLabel" | "ctaHref">) {
  const { scrollY } = useScroll();

  return (
    <section
      className="relative w-full h-screen bg-space overflow-hidden bg-noise"
      aria-labelledby="hero-headline"
    >
      <TopoGrid />

      {/* Navy radial glow — bottom */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70vw] h-64 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(30,74,141,0.15) 0%, transparent 70%)",
        }}
      />

      {/* Three-column cockpit layout */}
      <div className="relative z-10 h-full flex items-center gap-6 px-4 sm:px-8 max-w-[1400px] mx-auto">
        <HeroLeftPanel />
        <HeroCenterDisplay
          headline={headline}
          subheadline={subheadline}
          ctaLabel={ctaLabel}
          ctaHref={ctaHref}
          scrollY={scrollY}
        />
        <HeroRightPanel />
      </div>
    </section>
  );
}

// ─── Section: Stats Strip ─────────────────────────────────────────────────────

function StatsSection({ stats = DEFAULT_STATS }: { stats?: typeof DEFAULT_STATS }) {
  return (
    <div className="bg-navy-900 border-y border-horizon-blue/10">
      <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-silver/5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="px-8 first:pl-0 last:pr-0 flex flex-col items-center text-center"
          >
            <span className="font-mono text-3xl md:text-4xl font-medium text-silver tracking-tight">
              {stat.value}
            </span>
            <span className="font-mono text-[10px] tracking-[0.2em] text-horizon-blue/70 uppercase mt-1">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section: Features Grid ───────────────────────────────────────────────────

function FeaturesSection({ features = DEFAULT_FEATURES }: { features?: typeof DEFAULT_FEATURES }) {
  return (
    <section className="bg-white py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="mb-16 max-w-xl">
          <span className="font-mono text-[10px] tracking-[0.3em] text-horizon-blue uppercase">
            Our Services
          </span>
          <h2 className="font-sans text-3xl md:text-4xl font-semibold text-navy-900 mt-3 leading-tight">
            Everything your operation needs,
            <br />
            <span className="text-navy-600">ready when you need it.</span>
          </h2>
        </div>

        {/* 3-col feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div
      className="
        group relative p-7
        border border-slate-100 hover:border-navy-200
        rounded bg-white hover:bg-navy-50/30
        transition-all duration-300
        shadow-card hover:shadow-card-hover
      "
    >
      {/* Left accent bar */}
      <div className="absolute left-0 top-6 bottom-6 w-[2px] bg-navy-100 group-hover:bg-navy-600 rounded-full transition-colors duration-300" />

      <div className="text-2xl mb-4 select-none">{icon}</div>
      <h3 className="font-sans font-semibold text-navy-900 text-base mb-2">{title}</h3>
      <p className="font-sans text-sm text-slate-500 leading-relaxed">{body}</p>
    </div>
  );
}

// ─── Section: Highlight (Dark Glass) ─────────────────────────────────────────

function HighlightSection({
  highlights = DEFAULT_HIGHLIGHTS,
}: {
  highlights?: typeof DEFAULT_HIGHLIGHTS;
}) {
  return (
    <section className="relative bg-navy-900 py-24 px-6 overflow-hidden">
      {/* Background texture */}
      <div className="absolute inset-0 bg-noise opacity-40 pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-45deg, transparent, transparent 10px, rgba(56,178,172,0.02) 10px, rgba(56,178,172,0.02) 11px)",
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Section header */}
        <div className="mb-16 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <span className="font-mono text-[10px] tracking-[0.3em] text-horizon-blue uppercase">
              Why XVII LLC
            </span>
            <h2 className="font-sans text-3xl md:text-4xl font-semibold text-silver mt-3 leading-tight">
              Built for operators,
              <br />
              <span className="text-silver/50">by aviation professionals.</span>
            </h2>
          </div>
          <a
            href="/about"
            className="font-mono text-xs tracking-widest text-horizon-blue hover:text-silver uppercase transition-colors duration-200 whitespace-nowrap"
          >
            Learn More →
          </a>
        </div>

        {/* Glass cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {highlights.map((card) => (
            <GlassHighlightCard key={card.title} {...card} />
          ))}
        </div>
      </div>
    </section>
  );
}

function GlassHighlightCard({ tag, title, body }: { tag: string; title: string; body: string }) {
  return (
    <div
      className="
        relative p-7 rounded
        bg-white/[0.04] hover:bg-white/[0.07]
        border border-white/10 hover:border-horizon-blue/30
        backdrop-blur-sm
        transition-all duration-300
      "
    >
      {/* Tag */}
      <span className="font-mono text-[9px] tracking-[0.35em] text-horizon-blue uppercase">
        {tag}
      </span>

      {/* Divider */}
      <div className="w-8 h-px bg-horizon-blue/30 my-4" />

      <h3 className="font-sans font-semibold text-silver text-base mb-3 leading-snug">{title}</h3>
      <p className="font-sans text-sm text-silver/45 leading-relaxed">{body}</p>
    </div>
  );
}

// ─── Section: CTA Banner ──────────────────────────────────────────────────────

function CtaSection({
  headline = "Ready to source your next part?",
  body = "Tell us what you need. We'll have a quote in your inbox within the hour.",
  buttonLabel = "Start a Quote Request",
}: {
  headline?: string;
  body?: string;
  buttonLabel?: string;
}) {
  return (
    <section className="relative bg-burgundy-700 py-20 px-6 overflow-hidden">
      {/* Noise grain */}
      <div className="absolute inset-0 bg-noise opacity-20 pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <h2 className="font-sans text-3xl md:text-4xl font-semibold text-white leading-tight mb-5">
          {headline}
        </h2>
        <p className="font-sans text-base text-white/60 mb-10 max-w-lg mx-auto">{body}</p>
        <a
          href="/contact"
          className="
            inline-flex items-center gap-2 px-8 py-4
            bg-white hover:bg-silver
            text-burgundy-700 font-sans font-semibold text-sm tracking-wide
            rounded transition-all duration-200
            shadow-[0_2px_20px_rgba(0,0,0,0.25)]
          "
        >
          {buttonLabel}
          <span className="font-mono text-xs">→</span>
        </a>
      </div>
    </section>
  );
}

// ─── Design System Reference ──────────────────────────────────────────────────

function DesignTokensReference() {
  const colors = [
    { name: "space", bg: "#020617", text: "#fff", label: "Hero BG" },
    { name: "navy-900", bg: "#132b51", text: "#fff", label: "Dark sections" },
    { name: "navy-800", bg: "#163462", text: "#fff", label: "Elevated dark" },
    { name: "navy-600", bg: "#1e4a8d", text: "#fff", label: "Primary brand" },
    { name: "burgundy-600", bg: "#9c2a3e", text: "#fff", label: "CTA / Accent" },
    { name: "horizon-blue", bg: "#38B2AC", text: "#000", label: "Decorative" },
    { name: "silver", bg: "#F8FAFC", text: "#000", label: "Dark-bg text" },
    { name: "white", bg: "#ffffff", text: "#000", label: "Light sections" },
  ];

  return (
    <section className="bg-space border-t border-silver/5 py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <span className="font-mono text-[10px] tracking-[0.3em] text-horizon-blue uppercase">
          Design System
        </span>
        <h2 className="font-sans text-2xl font-semibold text-silver mt-3 mb-12">Token Reference</h2>

        {/* Color palette */}
        <div className="mb-14">
          <h3 className="font-mono text-xs tracking-[0.2em] text-silver/40 uppercase mb-5">
            Color Tokens
          </h3>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
            {colors.map((c) => (
              <div key={c.name} className="flex flex-col gap-2">
                <div
                  className="h-12 rounded border border-white/5"
                  style={{ backgroundColor: c.bg }}
                />
                <span className="font-mono text-[9px] text-silver/40 leading-tight">{c.name}</span>
                <span className="font-mono text-[9px] text-silver/25">{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Typography */}
        <div className="mb-14">
          <h3 className="font-mono text-xs tracking-[0.2em] text-silver/40 uppercase mb-5">
            Typography
          </h3>
          <div className="space-y-4">
            <div>
              <span className="font-mono text-[9px] text-silver/30 uppercase tracking-widest">
                Display / IBM Plex Sans 600
              </span>
              <p className="font-sans font-semibold text-4xl text-silver mt-1">
                Precision Aviation Sourcing
              </p>
            </div>
            <div>
              <span className="font-mono text-[9px] text-silver/30 uppercase tracking-widest">
                Body / IBM Plex Sans 400
              </span>
              <p className="font-sans text-base text-silver/60 mt-1">
                Certified parts, global reach, same-day dispatch from Miami.
              </p>
            </div>
            <div>
              <span className="font-mono text-[9px] text-silver/30 uppercase tracking-widest">
                Data / IBM Plex Mono 400
              </span>
              <p className="font-mono text-sm text-horizon-blue mt-1">
                P/N 737-GE-CF6-80C2 · CERT: 8130-3 · QTY: 24 UNITS
              </p>
            </div>
            <div>
              <span className="font-mono text-[9px] text-silver/30 uppercase tracking-widest">
                Label / IBM Plex Mono 400
              </span>
              <p className="font-mono text-[10px] tracking-[0.3em] text-horizon-blue uppercase mt-1">
                Section Label
              </p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="mb-14">
          <h3 className="font-mono text-xs tracking-[0.2em] text-silver/40 uppercase mb-5">
            Button Variants
          </h3>
          <div className="flex flex-wrap gap-4 items-center">
            <button className="px-6 py-3 bg-burgundy-600 hover:bg-burgundy-500 text-white font-sans font-medium text-sm tracking-wide rounded transition-colors duration-200">
              Primary CTA
            </button>
            <button className="px-6 py-3 border border-silver/20 hover:border-silver/40 text-silver/70 hover:text-silver font-sans font-medium text-sm tracking-wide rounded transition-all duration-200 backdrop-blur-sm">
              Secondary
            </button>
            <button className="px-6 py-3 bg-navy-600 hover:bg-navy-500 text-white font-sans font-medium text-sm tracking-wide rounded transition-colors duration-200">
              Navy
            </button>
            <button className="font-mono text-xs tracking-[0.25em] text-horizon-blue hover:text-silver uppercase transition-colors duration-200">
              Text Link →
            </button>
          </div>
        </div>

        {/* Status badges */}
        <div>
          <h3 className="font-mono text-xs tracking-[0.2em] text-silver/40 uppercase mb-5">
            Status Badges
          </h3>
          <div className="flex flex-wrap gap-3">
            <StatusBadge variant="available">Available</StatusBadge>
            <StatusBadge variant="limited">Limited Stock</StatusBadge>
            <StatusBadge variant="aog">AOG Priority</StatusBadge>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Utility Components ───────────────────────────────────────────────────────

function HudCorner({
  position,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}) {
  const positionClasses = {
    "top-left": "top-6 left-6",
    "top-right": "top-6 right-6",
    "bottom-left": "bottom-6 left-6",
    "bottom-right": "bottom-6 right-6",
  };
  const rotations = {
    "top-left": "",
    "top-right": "rotate-90",
    "bottom-left": "-rotate-90",
    "bottom-right": "rotate-180",
  };
  return (
    <div className={`absolute ${positionClasses[position]} pointer-events-none hidden md:block`}>
      <div className={`${rotations[position]} w-8 h-8 relative opacity-20`}>
        <div className="absolute top-0 left-0 w-full h-px bg-horizon-blue" />
        <div className="absolute top-0 left-0 h-full w-px bg-horizon-blue" />
      </div>
    </div>
  );
}

function StatusBadge({
  variant,
  children,
}: {
  variant: "available" | "limited" | "aog";
  children: React.ReactNode;
}) {
  const styles = {
    available: "bg-emerald-950/60 text-emerald-400 border-emerald-800/40",
    limited: "bg-amber-950/60  text-amber-400  border-amber-800/40",
    aog: "bg-red-950/60   text-red-400    border-red-800/40",
  };
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-3 py-1
        font-mono text-[10px] tracking-[0.2em] uppercase
        border rounded ${styles[variant]}
      `}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-subtle" />
      {children}
    </span>
  );
}

// ─── Composed Page Template ───────────────────────────────────────────────────

/**
 * PageTemplate — Drop this between <Navbar /> and <Footer /> for any new marketing page.
 * Swap out the default props to customize content.
 */
export function PageTemplate({
  headline,
  subheadline,
  ctaLabel,
  ctaHref,
  stats = DEFAULT_STATS,
  features = DEFAULT_FEATURES,
  highlights = DEFAULT_HIGHLIGHTS,
  ctaSectionHeadline,
  ctaSectionBody,
  ctaSectionButtonLabel,
}: PageTemplateProps = {}) {
  return (
    <>
      <HeroSection
        headline={headline}
        subheadline={subheadline}
        ctaLabel={ctaLabel}
        ctaHref={ctaHref}
      />
      <StatsSection stats={stats} />
      <FeaturesSection features={features} />
      <HighlightSection highlights={highlights} />
      <CtaSection
        headline={ctaSectionHeadline}
        body={ctaSectionBody}
        buttonLabel={ctaSectionButtonLabel}
      />
    </>
  );
}

export {
  HeroSection,
  StatsSection,
  FeaturesSection,
  HighlightSection,
  CtaSection,
  DesignTokensReference,
  StatusBadge,
  HudCorner,
};
