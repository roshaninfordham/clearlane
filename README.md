# ClearLane MCP

Audit-ready bus reliability investigations from MTA + NYC Open Data + optional vision evidence.

ClearLane MCP is an npm-installable CLI and MCP stdio server for civic technologists, agency analysts, and hackathon teams investigating slow NYC bus corridors. It combines MTA route speed data, NYC Open Data, 311 complaints, optional image/video evidence, transparent scoring, and an append-only hash-chained audit ledger.

ClearLane is not a generic chatbot. It is an MCP-enabled investigation workflow for transit reliability.

## Government Problem

Bus speeds and reliability are hurt by traffic, curb conflicts, double parking, blocked stops, delivery activity, and lane encroachment. Agencies often have relevant APIs, open datasets, 311 complaints, field photos, and analyst knowledge, but the evidence is scattered. ClearLane turns that evidence into a single operational report that answers:

> Why is this route or corridor slow, where are the bottlenecks, what evidence supports the finding, and what operational actions should DOT/MTA consider?

## Why Auditability Matters

Every ClearLane run writes `audit-log.ndjson`, an append-only ledger where each event includes source references, query context, timestamps, claims, confidence, output references, and a SHA-256 hash chain. The companion `audit-manifest.json` records artifact hashes and the final ledger hash so a reviewer can detect tampering.

## Installation

```bash
npm install
npm run build
```

Or use the package through `npx` after publishing:

```bash
npx @roshansharma/clearlane-mcp init --client cursor
```

## Quickstart

```bash
npx @roshansharma/clearlane-mcp init --client cursor
npx @roshansharma/clearlane-mcp audit --route M15 --borough Manhattan --period weekday_am --mock --out ./output
```

Local development:

```bash
npm run build
node dist/cli/index.js init --client cursor --local
node dist/cli/index.js audit --route M15 --borough Manhattan --period weekday_am --mock --out ./output
node dist/cli/index.js verify-ledger ./output/audit-log.ndjson
```

## MCP Setup

Cursor:

```bash
npx @roshansharma/clearlane-mcp init --client cursor
```

Codex:

```bash
npx @roshansharma/clearlane-mcp init --client codex
```

OpenCode:

```bash
npx @roshansharma/clearlane-mcp init --client opencode
```

All clients:

```bash
npx @roshansharma/clearlane-mcp init --client all
```

Local MCP configs use:

```bash
node ./dist/mcp/server.js
```

## MCP Prompt Example

Use ClearLane to audit the M15 route for weekday AM reliability. Use mock mode if live APIs are unavailable. Generate the report and verify the audit ledger.

## CLI Examples

```bash
clearlane doctor
clearlane audit --route M15 --borough Manhattan --period weekday_am --mock --out ./output
clearlane analyze-evidence ./input/evidence --out ./output --mock
clearlane report --from ./output/route-health.json --out ./output
clearlane verify-ledger ./output/audit-log.ndjson
clearlane inspect-source --dataset kufs-yh3x --limit 5
```

## Environment Variables

```bash
OPENAI_API_KEY=
MTA_API_KEY=
NYC_OPEN_DATA_APP_TOKEN=
```

Behavior:

- Missing `MTA_API_KEY`: real-time MTA Bus Time calls are skipped.
- Missing `NYC_OPEN_DATA_APP_TOKEN`: anonymous Socrata requests still work, but may be throttled.
- Missing `OPENAI_API_KEY`: optional vision analysis is skipped unless `--mock` is used.

`clearlane doctor` reports presence only and never prints secret values.

## Output Artifacts

```text
output/
  report.md
  report.pdf
  metrics.json
  route-health.json
  slow-segments.geojson
  recommendations.json
  audit-log.ndjson
  audit-manifest.json
  evidence/
    analyzed-frame-001.jpg
    analyzed-frame-002.jpg
```

## Privacy Posture

ClearLane does not identify people, read or report license plates, track individuals, infer protected attributes, perform biometric analysis, or make legal/enforcement determinations. Evidence findings are operational and always marked for human review.

Every report states:

> ClearLane is a decision-support tool. Findings are based on available data and optional visual evidence. They require human review before operational, enforcement, or policy action.

## Demo Mode

The demo never requires API keys:

```bash
npm run demo
```

Mock M15 output includes 12 segments analyzed, 3 priority bottlenecks, 5.8 mph lowest observed average speed, 42 relevant 311 complaints, 2 optional vision findings, and 4 recommendations.

## Limitations

- Live public dataset schemas may change; ClearLane uses schema-flexible adapters and falls back to mock data when needed.
- Geo matching is intentionally lightweight for hackathon use.
- Vision evidence is decision support only and requires human review.
- The package is published under the maintainer-owned `@roshansharma` npm scope.

## Publishing

Do not publish unless the repo owner explicitly authorizes it and npm credentials are available.

Maintainer local flow:

```bash
npm login
npm whoami
npm run typecheck
npm run lint
npm test
npm run build
npm run pack:dry
npm run publish:dry
npm publish --access public
```

If npm Trusted Publishing is connected to this GitHub repository, use the `Release`
workflow from GitHub Actions. The workflow publishes with provenance using GitHub OIDC
and does not require an `NPM_TOKEN` secret.

## License

MIT
