import type { Metadata } from "next";
import Checker from "./Checker";
import s from "./page.module.css";
import { FAQ, LINKS, RULES } from "@/lib/content";

// Title and description target "amazon image requirements" plus the tool-intent gap ("checker"); see research/amazon-keywords.md.
export const metadata: Metadata = {
  title: "Amazon Image Requirements Checker & Fixer (2026), Free",
  description:
    "Check your main photo against Amazon's image requirements, then download a fixed version: pure white background, 85% fill, square and up to 2,000px. Free, no signup.",
};

// FAQPage no longer earns Google rich results for commercial sites (2023 change), but it still helps
// search engines and AI answer engines parse the Q&A. Built from the same data as the visible FAQ.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebApplication",
      name: "Amazon Image Requirements Checker & Fixer",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ],
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <main>
        <section className="hero">
          <div className="wrap">
            <p className="kicker">Free · No signup · Amazon-ready in seconds</p>
            <h1 className="h1">Check and fix your photo for Amazon&apos;s image requirements</h1>
            <p className="sub">
              Upload your main product photo. See what would get it rejected, then download a fixed version: pure white
              background, 85% fill, square, up to 2,000px.
            </p>
            <Checker />
          </div>
        </section>

        <div className="wrap">
          <section className={s.section} aria-labelledby="rules">
            <h2 id="rules">Amazon&apos;s main image requirements</h2>
            <ol className={s.rules}>
              {RULES.map((r, i) => (
                <li key={r.title}>
                  <span className={s.num}>{i + 1}</span>
                  <div>
                    <h3>{r.title}</h3>
                    <p className="muted">{r.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="muted small">
              These rules apply to the main image; your other images can be lifestyle shots, infographics or close-ups. Some categories add
              their own: footwear shows a single shoe facing left at 45°, and children&apos;s fitted clothing is shown flat.{" "}
              <a href={LINKS.aiPhotos("rules-note")} target="_blank" rel="noopener">
                Try AI product photography for your other images →
              </a>
            </p>
          </section>

          <section className={`card ${s.bulk}`} aria-labelledby="bulk">
            <h2 id="bulk">Listing hundreds of products?</h2>
            <p>
              Checking one photo is a start. Photoroom&apos;s Batch mode gives your whole catalogue the same pure white background,
              85% fill and 2000px size in one go.
            </p>
            <div className={s.ctaRow}>
              <a className="btn" href={LINKS.batch("bulk-section")} target="_blank" rel="noopener">
                Do it in bulk on Photoroom
              </a>
              <a className="btn ghost" href={LINKS.api("bulk-section")} target="_blank" rel="noopener">
                Explore the Photoroom API
              </a>
            </div>
          </section>

          <section className={s.section} aria-labelledby="faq">
            <h2 id="faq">Frequently asked questions</h2>
            <div className={s.faq}>
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>
                    <h3>{f.q}</h3>
                  </summary>
                  <p>{f.a}</p>
                  {f.link && (
                    <a href={f.link.href} target="_blank" rel="noopener">
                      {f.link.label} →
                    </a>
                  )}
                </details>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
