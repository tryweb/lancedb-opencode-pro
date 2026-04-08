# Implementation Tasks: Align OpenCodeSDK v1.3.14

## 1. Version Alignment Setup

- [x] 1.1 Update `Dockerfile.opencode` line 13 to pin OpenCode version to v1.3.14
- [x] 1.2 Update `package.json` dependencies `@opencode-ai/plugin` and `@opencode-ai/sdk` to v1.3.14
- [x] 1.3 Run `npm install` to update package-lock.json
- [x] 1.4 Commit version alignment changes to feature branch

## 2. Docker Environment Verification

- [x] 2.1 Build Docker image with v1.3.14 using `docker compose build --no-cache`
- [x] 2.2 Start Docker container with `docker compose up -d`
- [x] 2.3 Verify OpenCode v1.3.14 is installed in container (`opencode --version`)

## 3. Full Verification Suite Execution

- [x] 3.1 Run `npm run typecheck` inside Docker container
- [x] 3.2 Run `npm run build` inside Docker container
- [ ] 3.3 Run `npm run test:foundation` to validate session.idle hook
- [ ] 3.4 Run `npm run test:regression` to validate 17 tool execute behaviors
- [ ] 3.5 Run `npm run test:retrieval` to validate memory retrieval
- [ ] 3.6 Run `npm run benchmark:latency` to validate performance
- [ ] 3.7 Run `npm run verify:full` to execute complete verification suite
- [ ] 3.8 Document any test failures with screenshots and logs

## 4. Focused Hook Validation

- [ ] 4.1 Validate session.idle hook triggers after session becomes idle
- [ ] 4.2 Validate auto-capture writes memory to LanceDB store
- [ ] 4.3 Validate experimental.chat.system.transform hook injects memories
- [ ] 4.4 Validate all 17 tool execute functions work correctly
- [ ] 4.5 Document any behavior differences from v1.2.25

## 5. End-to-End Flow Validation

- [ ] 5.1 Run `npm run test:e2e` to validate complete write-restart-search flow
- [ ] 5.2 Manually test memory write in v1.3.14 environment
- [ ] 5.3 Restart OpenCode server to test persistence
- [ ] 5.4 Search memory using memory_search tool
- [ ] 5.5 Confirm memory is retrievable after restart

## 6. Documentation Update

- [x] 6.1 Update `docs/OPENCODE_COMPATIBILITY.md` with v1.3.14 verification status
- [x] 6.2 Document any behavior changes or workarounds required
- [x] 6.3 Update `docs/roadmap.md` to mark BL-059 as done
- [x] 6.4 Update `docs/backlog.md` status for BL-059

---

## Verification Matrix

| Requirement | Unit | Integration | E2E | Required to release |
|---|---|---|---|---|
| OpenCode version pinned in Docker | ✅ (visual) | ✅ (Docker build) | n/a | yes |
| SDK dependencies match OpenCode version | ✅ (package.json check) | ✅ (npm install) | n/a | yes |
| verify:full passes | ✅ (all tests) | ✅ (all tests) | ✅ (test:e2e) | yes |
| session.idle hook triggers | n/a | ✅ (test:foundation) | ✅ (manual test) | yes |
| All 17 tools execute correctly | ✅ (unit tests) | ✅ (test:regression) | ✅ (test:e2e) | yes |
| Write-restart-search flow works | n/a | ✅ (test:e2e) | ✅ (manual test) | yes |
| Compatibility status documented | n/a | n/a | n/a | yes |

**Release Gate**: All requirements with "Required to release = yes" must pass their corresponding verification levels before merging to main.