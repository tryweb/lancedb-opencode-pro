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

## Effectiveness Feedback

- [ ] Users can report missing memory that should have been stored.
- [ ] Users can report stored memory that should not have been kept.
- [ ] Users can report whether recalled memory was helpful.
- [ ] Operators can inspect machine-readable effectiveness summary output.

## Build And Packaging

- [ ] `docker compose build --no-cache && docker compose up -d` succeeds.
- [ ] `docker compose exec app npm run typecheck` succeeds.
- [ ] `docker compose exec app npm run build` succeeds.
- [ ] `docker compose exec app npm pack` produces installable tarball.
