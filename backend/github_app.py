import os


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
