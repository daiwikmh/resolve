import { CTAFooter } from "@/components/landing/CTAFooter";
import { Features } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import { RugStats } from "@/components/landing/RugStats";
import { StackedSection } from "@/components/landing/StackedSection";

const sections = [
  { id: "hero", node: <Hero /> },
  { id: "stats", node: <RugStats /> },
  { id: "features", node: <Features /> },
  { id: "cta", node: <CTAFooter /> },
];

export default function Page() {
  return (
    <main className="relative">
      <div style={{ height: `${sections.length * 100}svh` }}>
        {sections.map((s, i) => (
          <StackedSection key={s.id} id={s.id} index={i} total={sections.length}>
            {s.node}
          </StackedSection>
        ))}
      </div>
    </main>
  );
}
