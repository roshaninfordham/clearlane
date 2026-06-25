# Changelog

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
