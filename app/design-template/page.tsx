/**
 * /design-template
 *
 * Living design system showcase for XVII-LLC.
 * Visit this route in dev to see all design patterns in context.
 * This page is the source of truth for layout, tokens, and components.
 */

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PageTemplate, DesignTokensReference } from "@/components/templates/PageTemplate";

export const metadata = {
  title: "Design Template — GENTHRUST XVII LLC",
  robots: { index: false, follow: false },
};

export default function DesignTemplatePage() {
  return (
    <main className="bg-white text-slate-900">
      <Navbar />

      {/* Full composed page template — default content */}
      <PageTemplate />

      {/* Design system reference (dev-only section) */}
      <DesignTokensReference />

      <Footer />
    </main>
  );
}
