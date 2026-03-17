#!/usr/bin/env bash

set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: gh CLI is required."
  exit 1
fi

OWNER="${OWNER:-tryweb}"
REPO="${REPO:-lancedb-opencode-pro}"
BRANCH="${BRANCH:-main}"
REQUIRED_CHECKS="${REQUIRED_CHECKS:-verify}"
REVIEW_COUNT="${REVIEW_COUNT:-1}"
ENFORCE_ADMINS="${ENFORCE_ADMINS:-true}"
DISMISS_STALE_REVIEWS="${DISMISS_STALE_REVIEWS:-true}"
REQUIRE_CODE_OWNER_REVIEWS="${REQUIRE_CODE_OWNER_REVIEWS:-false}"
REQUIRE_CONVERSATION_RESOLUTION="${REQUIRE_CONVERSATION_RESOLUTION:-true}"
ALLOW_FORCE_PUSHES="${ALLOW_FORCE_PUSHES:-false}"
ALLOW_DELETIONS="${ALLOW_DELETIONS:-false}"
GITHUB_SECRETS="${GITHUB_SECRETS:-}"

if [[ -n "${GH_TOKEN:-}" ]]; then
  export GH_TOKEN
fi

contexts_json="$({
  python3 - <<'PY'
import json
import os

checks = [item.strip() for item in os.environ.get("REQUIRED_CHECKS", "verify").split(",") if item.strip()]
print(json.dumps(checks))
PY
} )"

echo "Applying branch protection to ${OWNER}/${REPO}:${BRANCH}"

gh api \
  --method PUT \
  "repos/${OWNER}/${REPO}/branches/${BRANCH}/protection" \
  --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": ${contexts_json}
  },
  "enforce_admins": ${ENFORCE_ADMINS},
  "required_pull_request_reviews": {
    "required_approving_review_count": ${REVIEW_COUNT},
    "dismiss_stale_reviews": ${DISMISS_STALE_REVIEWS},
    "require_code_owner_reviews": ${REQUIRE_CODE_OWNER_REVIEWS}
  },
  "required_conversation_resolution": ${REQUIRE_CONVERSATION_RESOLUTION},
  "allow_force_pushes": ${ALLOW_FORCE_PUSHES},
  "allow_deletions": ${ALLOW_DELETIONS},
  "restrictions": null
}
EOF

if [[ -n "${GITHUB_SECRETS}" ]]; then
  IFS=',' read -r -a secret_names <<< "${GITHUB_SECRETS}"
  for raw_name in "${secret_names[@]}"; do
    name="$(printf '%s' "${raw_name}" | xargs)"
    if [[ -z "${name}" ]]; then
      continue
    fi

    value="${!name:-}"
    if [[ -z "${value}" ]]; then
      echo "Skipping secret ${name}: environment variable is empty or unset"
      continue
    fi

    printf '%s' "${value}" | gh secret set "${name}" --repo "${OWNER}/${REPO}" --body -
    echo "Secret ${name} configured"
  done
fi

echo "GitHub bootstrap completed for ${OWNER}/${REPO}"
