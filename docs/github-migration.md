# GitHub Migration Runbook

This runbook finalizes post-migration repository setup after moving from GitLab to GitHub.

## Scope

- Apply branch protection on `main`
- Configure optional GitHub Actions repository secrets
- Verify the repository setup from CLI

## Prerequisites

- `gh` is installed and available in `PATH`
- You have admin/maintainer permission for `tryweb/lancedb-opencode-pro`
- Authentication is ready via one of:
  - `gh auth login`
  - `GH_TOKEN` environment variable

## One-Command Bootstrap

Run from repository root:

```bash
export PATH="$HOME/.local/bin:$PATH"
export GH_TOKEN="<github-token>"
OWNER=tryweb REPO=lancedb-opencode-pro BRANCH=main \
REQUIRED_CHECKS="verify" \
REVIEW_COUNT=1 \
REQUIRE_CONVERSATION_RESOLUTION=true \
./scripts/bootstrap-github-repo.sh
```

### Optional: Set Repository Secrets at the Same Time

Provide secret names via `GITHUB_SECRETS` and export matching environment variables:

```bash
export PATH="$HOME/.local/bin:$PATH"
export GH_TOKEN="<github-token>"
export NPM_TOKEN="<npm-token>"
export GITHUB_SECRETS="NPM_TOKEN"
./scripts/bootstrap-github-repo.sh
```

If a secret name is included but its environment variable is empty, the script skips it safely.

## Verification Commands

Check branch protection:

```bash
export PATH="$HOME/.local/bin:$PATH"
export GH_TOKEN="<github-token>"
gh api repos/tryweb/lancedb-opencode-pro/branches/main/protection
```

List repository secrets metadata:

```bash
export PATH="$HOME/.local/bin:$PATH"
export GH_TOKEN="<github-token>"
gh secret list --repo tryweb/lancedb-opencode-pro
```

## CI Validation (Docker-based)

After migration setup, run the same validation flow used by CI:

```bash
docker compose build --no-cache && docker compose up -d
docker compose exec -T app npm run verify
docker compose down -v --remove-orphans
```

## Notes

- Current workflow file: `.github/workflows/ci.yml`
- Status check context should match workflow job names (default: `verify`)
- Tune policy by environment variables in `scripts/bootstrap-github-repo.sh`
