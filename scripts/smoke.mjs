// Boots the built Electron app via Playwright, verifies the renderer mounted
// and the IPC bridge works, then saves a screenshot to artifacts/smoke.png.
// Run after `npm run build`:  npm run smoke
import { _electron as electron } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT_DIR = 'artifacts'
mkdirSync(OUT_DIR, { recursive: true })

const app = await electron.launch({ args: ['.'] })

try {
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  await window.waitForSelector('#root *', { timeout: 15000 })

  // Exercise the renderer -> preload -> main -> back round-trip.
  await window.getByRole('button', { name: 'Ping main process' }).click()
  await window.getByTestId('pong').filter({ hasText: 'pong' }).waitFor({ timeout: 5000 })

  const title = await window.title()
  const pong = await window.getByTestId('pong').innerText()
  const versions = await window.getByTestId('versions').innerText()

  await window.screenshot({ path: `${OUT_DIR}/smoke.png` })

  console.log('✓ window title :', title)
  console.log('✓ ipc ping     :', pong)
  console.log('✓ versions     :', versions.replace(/\n/g, ' · '))
  console.log(`✓ screenshot   : ${OUT_DIR}/smoke.png`)
} finally {
  await app.close()
}
