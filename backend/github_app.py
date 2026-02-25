import os
import time

import jwt
import requests


def get_github_private_key() -> str | None:
    """Return PEM content from GITHUB_PRIVATE_KEY (Railway) or file at GITHUB_PRIVATE_KEY_PATH (local)."""
    raw = os.environ.get("GITHUB_PRIVATE_KEY")
    if raw:
        return raw.strip().replace("\\n", "\n")
    path = os.environ.get("GITHUB_PRIVATE_KEY_PATH")
    if path and os.path.isfile(path):
        with open(path, "r") as f:
            return f.read()
    return None


def get_installation_token(installation_id: int) -> str:
    """Get a short-lived access token for the given installation. Raises RuntimeError on failure."""
    app_id = os.environ.get("GITHUB_APP_ID")
    private_key = get_github_private_key()
    if not app_id or not private_key:
        raise RuntimeError("GITHUB_APP_ID or private key not configured")
    now = int(time.time())
    payload = {"iat": now - 60, "exp": now + 600, "iss": app_id}
    jwt_token = jwt.encode(payload, private_key, algorithm="RS256")
    headers = {"Authorization": f"Bearer {jwt_token}", "Accept": "application/vnd.github+json"}
    resp = requests.post(
        f"https://api.github.com/app/installations/{installation_id}/access_tokens",
        headers=headers,
        timeout=10,
    )
    if resp.status_code >= 300:
        raise RuntimeError(f"GitHub token failed: {resp.status_code}")
    token = (resp.json() or {}).get("token")
    if not token:
        raise RuntimeError("No token in GitHub response")
    return token
