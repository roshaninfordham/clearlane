# ClearLane MCP Architecture

NYC buses serve 1.1M+ daily riders, yet 186 of 332 bus lines received D/F grades for speed, bunching, and on-time performance; MTA also notes buses are slowed by double-parking, delivery vehicles, road closures, and traffic.

Today, analysts manually stitch together MTA data, NYC Open Data, 311 complaints, maps, and field evidence; ClearLane MCP turns those disconnected sources into an audit-ready reliability report with bottlenecks, likely causes, evidence, recommendations, and append-only JSON logs.

![ClearLane MCP system architecture](./assets/system-architecture.svg)

![ClearLane MCP output flow](./assets/output-flow.svg)

## Mermaid Source

GitHub renders this diagram natively. The npm package page uses the static SVGs above because npm currently displays Mermaid source as plain text.

```mermaid
flowchart TD
  user["Analyst asks natural-language question"]
  client["Cursor / Codex / OpenCode / MCP client"]
  setup["clearlane.get_setup_status"]
  configure["Local terminal: clearlane configure"]
  ask["clearlane.answer_question / clearlane ask"]
  audit["Audit pipeline"]
  mta["MTA Open Data segment speeds"]
  bustime["MTA Bus Time realtime vehicles"]
  open311["NYC Open Data 311 complaints"]
  lanes["NYC Open Data bus lanes"]
  evidence["Optional images/video evidence"]
  score["ClearLane scoring and recommendation agents"]
  outputs["Shareable artifacts"]
  ledger["Append-only JSON audit rail"]
  report["Markdown/PDF reports with Mermaid"]

  user --> client
  client --> setup
  setup -->|"missing keys"| configure
  setup -->|"configured or mock"| ask
  configure --> ask
  ask --> audit
  audit --> mta
  audit --> bustime
  audit --> open311
  audit --> lanes
  audit --> evidence
  mta --> score
  bustime --> score
  open311 --> score
  lanes --> score
  evidence --> score
  score --> outputs
  outputs --> ledger
  outputs --> report
```

## Demo Question

```text
Bus speeds are negatively impacted by cars parked in bus lanes and other bus lane obstructions. NYPD has finite resources to enforce traffic laws. How can we use cameras and other technology to conduct more targeted enforcement or automated enforcement?
```

## Demo Command

```bash
clearlane ask "Bus speeds are negatively impacted by cars parked in bus lanes and other bus lane obstructions. NYPD has finite resources to enforce traffic laws. How can we use cameras and other technology to conduct more targeted enforcement or automated enforcement?" --route M15 --borough Manhattan --period weekday_am --out ./demo-output/live-enforcement
```

## Expected Demo Artifacts

```text
demo-output/live-enforcement/
  question-answer.json
  question-report.md
  question-report.pdf
  context-cache.json
  report.md
  report.pdf
  metrics.json
  route-health.json
  slow-segments.geojson
  recommendations.json
  audit-log.ndjson
  audit-manifest.json
```

## Pitch Line

ClearLane turns scattered MTA, Bus Time, NYC Open Data, 311, and optional camera evidence into an audit-ready action plan for targeted bus reliability interventions.
