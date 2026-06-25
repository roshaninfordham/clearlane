# Security Policy

Report vulnerabilities privately to the maintainers before public disclosure.

ClearLane MCP never requires API keys in generated project configuration. Use environment
variables such as `OPENAI_API_KEY`, `MTA_API_KEY`, and `NYC_OPEN_DATA_APP_TOKEN`.

Do not paste API keys into Cursor, Codex, OpenCode, or MCP chat. Use `clearlane configure`
or environment variables. Local file credential storage is a fallback and is written with
owner-only permissions where supported.

Do not commit raw evidence, generated audit logs, `.env` files, or videos.
