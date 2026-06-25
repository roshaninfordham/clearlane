# Changelog

## 0.4.0

- Add enforcement/camera-specific natural-language answers for targeted bus-lane obstruction questions.
- Generate `question-report.pdf` with a rendered flowchart diagram alongside `question-report.md`, `question-answer.json`, and the audit ledger.
- Add a GitHub Mermaid architecture diagram in `docs/architecture.md`.
- Add the NYC bus reliability problem statement and demo pitch language to repository docs.
- Improve live NYC bus-lane API queries by route and borough, including M15 bus-lane context.
- Default live natural-language questions to a trailing one-year 311 complaint window when no dates are provided.
- Keep relative output paths when users pass relative output directories, making reports easier to share.
- Add a live demo artifact folder under `demo-output/live-enforcement`.

## 0.3.0

- Add `clearlane ask` and MCP `clearlane.answer_question` for natural-language transit reliability questions.
- Generate `question-answer.json`, `question-report.md`, `context-cache.json`, and Mermaid visual summaries.
- Fetch MTA Bus Time real-time vehicle snapshots and include them in route-health reports.
- Normalize live NY State MTA segment-speed fields, including `average_road_speed`, stop names, sample sizes, and geometry.
- Add best-effort live NYC Open Data bus-lane context and safer generated-output ignore rules.

## 0.2.0

- Add secure first-run credential setup with `clearlane configure`.
- Add `clearlane auth status` and MCP setup/status/help tools.
- Return structured `needs_configuration` results instead of requesting secrets in chat.
- Configure MCP clients to use the global `clearlane mcp` command by default.

## 0.1.2

- Align CLI and MCP server runtime version with the published npm package version.

## 0.1.1

- Add npm/GitHub tracking badges and explicit MIT package metadata.
- Link the GitHub repository to the published npm package.

## 0.1.0

- Initial ClearLane MCP package for audit-ready bus reliability investigations.
