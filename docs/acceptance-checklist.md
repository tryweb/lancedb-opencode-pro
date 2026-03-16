# Acceptance Checklist

## Daily Workflow

- [ ] Auto-capture stores durable memory after successful assistant completion.
- [ ] Later troubleshooting prompts can recall prior relevant memory.
- [ ] Switching project directory changes active scope isolation.
- [ ] Memory search returns ranked results with IDs and summaries.
- [ ] Memory delete removes a targeted record by ID or stable prefix.
- [ ] Memory clear only removes records in requested scope.

## Safety And Degradation

- [ ] Clear operation requires explicit `confirm=true`.
- [ ] Missing FTS index does not break retrieval.
- [ ] Missing embedding backend does not crash plugin hooks.

## Build And Packaging

- [ ] `docker compose build --no-cache && docker compose up -d` succeeds.
- [ ] `docker compose exec app npm run typecheck` succeeds.
- [ ] `docker compose exec app npm run build` succeeds.
- [ ] `docker compose exec app npm pack` produces installable tarball.
