import styles from "./page.module.css";

const roadmap = [
  {
    milestone: "M1",
    title: "Domain core",
    detail: "Session model, the Gap engine, the Tool registry, and the orchestration state machine.",
  },
  {
    milestone: "M2",
    title: "Mechanical tools",
    detail: "Encounter builder and treasure roller backed by the 5e SRD.",
  },
  {
    milestone: "M3",
    title: "Detection & the Scribe",
    detail: "LLM gap detection with reconciliation, the editor, and stable anchoring.",
  },
  {
    milestone: "M4",
    title: "Narrative tools",
    detail: "Vault-grounded seeds become owned sections; accept/reject prose diffs.",
  },
];

export default function Home() {
  return (
    <main className={styles.shell}>
      <header className={styles.hero}>
        <span className={styles.seal}>S</span>
        <p className={styles.kicker}>Scriptorium</p>
        <h1 className={styles.title}>Session Studio</h1>
        <p className={styles.tagline}>
          A prep companion for the dungeon master. Draft your session, let the
          Scribe surface what&rsquo;s still missing, and arrive at the table
          ready.
        </p>
        <p className={styles.invariant}>The Scribe proposes. The DM decides.</p>
      </header>

      <section className={styles.roadmap} aria-label="Build roadmap">
        <h2 className={styles.sectionHeading}>On the bench</h2>
        <ol className={styles.steps}>
          {roadmap.map((step) => (
            <li key={step.milestone} className={styles.step}>
              <span className={styles.milestone}>{step.milestone}</span>
              <div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDetail}>{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <footer className={styles.footer}>
        Next.js · Vercel · Supabase — see{" "}
        <code>docs/architecture.md</code> for the full plan.
      </footer>
    </main>
  );
}
