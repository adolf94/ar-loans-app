import { readFileSync } from "node:fs"
import { join } from "node:path"

function parseEnv(file) {
  const vars = {}
  let content
  try {
    content = readFileSync(file, "utf8")
  } catch {
    return vars
  }
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    vars[key] = value
  }
  return vars
}

export default async ({ directory }) => {
  const envFile = join(directory, ".devcontainer", ".env")
  return {
    "shell.env": (_input, output) => {
      const vars = parseEnv(envFile)
      for (const [key, value] of Object.entries(vars)) {
        if (!(key in output.env)) output.env[key] = value
      }
    },
  }
}
