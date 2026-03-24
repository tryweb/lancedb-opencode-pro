## 1. Dependency Update

- [x] 1.1 Update `@lancedb/lancedb` version in `package.json` from `^0.26.2` to `^0.27.1`
- [x] 1.2 Run `npm install` to update `package-lock.json`
- [x] 1.3 Run `npm run verify:full` locally to verify initial compatibility
- [x] 1.4 Run Docker verification: `docker compose build --no-cache && docker compose up -d && docker compose exec app npm run verify:full`
- [x] 1.5 Document local verification results in CHANGELOG.md

## 2. CI/CD Workflow Enhancement

- [x] 2.1 Create `.github/workflows/dependency-update.yml` with weekly scheduled check for LanceDB updates
- [x] 2.2 Add dependency audit step to check for known vulnerabilities with `npm audit --audit-level=moderate`
- [x] 2.3 Add version drift detection to compare current vs latest LanceDB version
- [x] 2.4 Add compatibility test job that builds and tests with latest version on schedule
- [x] 2.5 Add issue creation step when compatible update is available

## 3. CI Matrix Enhancement

- [x] 3.1 Add `verify-matrix` job to `.github/workflows/ci.yml` with Node.js 20 and Node.js 22
- [x] 3.2 Configure matrix fail-fast: false to run all versions regardless of individual failures
- [x] 3.3 Ensure Docker build passes `NODE_VERSION` build argument for matrix testing

## 4. Test Enhancement

- [x] 4.1 Review `test/foundation/foundation.test.ts` for FTS index test coverage
- [x] 4.2 Verify `test/regression/plugin.test.ts` covers `table.add()` cast error handling
- [x] 4.3 Verify schema migration tests cover `addColumns()` with SQL expressions
- [x] 4.4 Run `npm run test:foundation` and confirm all tests pass with LanceDB 0.27.1
- [x] 4.5 Run `npm run test:regression` and confirm all tests pass with LanceDB 0.27.1
- [x] 4.6 Run `npm run test:retrieval` to verify hybrid search functionality
- [x] 4.7 Run `npm run test:effectiveness` to verify event persistence

## 5. Documentation Update

- [x] 5.1 Update `CHANGELOG.md` with LanceDB upgrade entry and verification evidence
- [x] 5.2 Add LanceDB version tracking section to CHANGELOG.md
- [x] 5.3 Update README.md if dependency instructions need modification
- [x] 5.4 Create or update `docs/lancedb-upgrades.md` with upgrade history and compatibility notes

## 6. Verification and Merge

- [ ] 6.1 Push branch and monitor CI matrix results (Node 20, Node 22)
- [ ] 6.2 Review all CI checks: verify, dependency-audit, verify-matrix
- [ ] 6.3 Address any CI failures and re-run verification
- [ ] 6.4 Confirm all test suites pass (foundation, regression, retrieval, effectiveness)
- [ ] 6.5 Merge to main branch after all checks pass
- [ ] 6.6 Verify release tag build with `npm run release:check`

## 7. OpenSpec Archive

- [ ] 7.1 Run `/openspec-verify` to confirm implementation matches specs
- [ ] 7.2 Run `/openspec-archive` to archive the completed change
- [ ] 7.3 Verify specs are merged into `openspec/specs/` directory