import { useEffect, useState } from 'react'

type Versions = { electron: string; chrome: string; node: string }

function App(): JSX.Element {
  const [pong, setPong] = useState<string>('(not pinged yet)')
  const [versions, setVersions] = useState<Versions | null>(null)

  useEffect(() => {
    window.api.getVersions().then(setVersions).catch(console.error)
  }, [])

  const handlePing = async (): Promise<void> => {
    try {
      const result = await window.api.ping()
      setPong(result)
    } catch (error) {
      setPong(`error: ${String(error)}`)
    }
  }

  return (
    <main className="shell">
      <header className="hero">
        <span className="badge">local-first · electron · whisper</span>
        <h1>TTRPG Helper</h1>
        <p className="tagline">
          A dungeon master&rsquo;s companion — session prep and a live at-the-table HUD.
        </p>
      </header>

      <section className="card">
        <h2>Foundation check</h2>
        <p className="muted">
          Confirms the renderer mounted and the main&nbsp;&harr;&nbsp;preload&nbsp;&harr;&nbsp;renderer
          IPC bridge is wired.
        </p>
        <div className="ping-row">
          <button onClick={handlePing}>Ping main process</button>
          <code data-testid="pong">{pong}</code>
        </div>
        {versions && (
          <ul className="versions" data-testid="versions">
            <li>Electron {versions.electron}</li>
            <li>Chromium {versions.chrome}</li>
            <li>Node {versions.node}</li>
          </ul>
        )}
      </section>

      <section className="roadmap">
        <h2>Next up</h2>
        <ol>
          <li>Obsidian vault reader (watch a markdown folder)</li>
          <li>SRD data layer (monsters · items · spells)</li>
          <li>Live transcription via local Whisper</li>
          <li>Session-prep decision flow</li>
        </ol>
      </section>
    </main>
  )
}

export default App
