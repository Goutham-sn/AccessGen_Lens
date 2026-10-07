import fs from 'node:fs/promises'
import os from 'node:os'

// Peak memory of the browser while a persona runs, for run_timings. Reads
// /proc in the runner container: the proportional set size (PSS) of every
// Chromium process, summed, so memory two processes share is counted once
// between them. Falls back to the resident size where PSS is not readable.
// Returns null where /proc does not exist (not Linux).
const BROWSER_PROCESS = /chrom|headless_shell/i

async function browserMemoryKb() {
  let pids
  try { pids = (await fs.readdir('/proc')).filter((d) => /^\d+$/.test(d)) } catch { return null }
  let total = 0
  for (const pid of pids) {
    const comm = await fs.readFile(`/proc/${pid}/comm`, 'utf8').catch(() => '')
    if (!BROWSER_PROCESS.test(comm)) continue
    const rollup = await fs.readFile(`/proc/${pid}/smaps_rollup`, 'utf8').catch(() => null)
    const pss = rollup && /^Pss:\s+(\d+) kB/m.exec(rollup)
    if (pss) { total += Number(pss[1]); continue }
    const status = await fs.readFile(`/proc/${pid}/status`, 'utf8').catch(() => '')
    const rss = /^VmRSS:\s+(\d+) kB/m.exec(status)
    if (rss) total += Number(rss[1])
  }
  return total
}

// Samples every intervalMs until stop(), which returns the peak in MB.
export function sampleBrowserMemory(intervalMs = 500) {
  let peakKb = null
  let stopped = false
  const tick = async () => {
    const kb = await browserMemoryKb()
    if (kb != null) peakKb = Math.max(peakKb ?? 0, kb)
    if (!stopped) timer = setTimeout(tick, intervalMs)
  }
  let timer = setTimeout(tick, 0)
  return {
    async stop() {
      stopped = true
      clearTimeout(timer)
      const kb = await browserMemoryKb()
      if (kb != null) peakKb = Math.max(peakKb ?? 0, kb)
      return peakKb == null ? null : Math.round(peakKb / 1024)
    }
  }
}

// How loaded the machine was when a run began, for run_timings next to
// browserPeakMb. In the runner container these describe the Docker host (its
// VM on Windows and Mac): free memory in MB as the kernel reports it
// available, total memory, and the 1, 5 and 15 minute load averages.
export function hostSnapshot() {
  return {
    freeMemMb: Math.round(os.freemem() / 1048576),
    totalMemMb: Math.round(os.totalmem() / 1048576),
    loadAvg: os.loadavg().map((n) => Math.round(n * 100) / 100)
  }
}
