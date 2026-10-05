// Secrets have no defaults. A missing one stops the service at startup with
// a message that names it, instead of running with a value nobody chose.
export function requireEnv(...names) {
  const missing = names.filter((n) => !process.env[n])
  if (missing.length) {
    console.error(`[config] Missing required setting(s): ${missing.join(', ')}. Set them in .env (see .env.example).`)
    process.exit(1)
  }
  return Object.fromEntries(names.map((n) => [n, process.env[n]]))
}
