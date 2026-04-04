import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PageTemplate } from "@/components/templates/PageTemplate";

export default function Home() {
  return (
    <main className="bg-white text-slate-900">
      <Navbar />
      <PageTemplate />
      <Footer />
    </main>
  );
}
