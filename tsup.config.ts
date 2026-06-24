import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "cli/index": "src/cli/index.ts",
    "mcp/server": "src/mcp/server.ts",
    "scripts/prepublish-check": "scripts/prepublish-check.ts",
    "scripts/release-dry-run": "scripts/release-dry-run.ts"
  },
  format: ["esm"],
  target: "node20",
  platform: "node",
  clean: true,
  dts: true,
  sourcemap: true,
  splitting: false,
  banner: {
    js: "import { createRequire as __clearlaneCreateRequire } from 'module'; const require = __clearlaneCreateRequire(import.meta.url);"
  }
});
