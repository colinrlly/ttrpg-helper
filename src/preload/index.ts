import { contextBridge, ipcRenderer } from 'electron'

// The single, audited surface the renderer is allowed to touch. Everything that
// needs the filesystem, child processes, or hardware goes through here as an
// explicit IPC channel — the renderer never gets raw Node access.
const api = {
  ping: (): Promise<string> => ipcRenderer.invoke('app:ping'),
  getVersions: (): Promise<{ electron: string; chrome: string; node: string }> =>
    ipcRenderer.invoke('app:getVersions')
}

export type Api = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore — fallback only used if contextIsolation is ever disabled
  window.api = api
}
