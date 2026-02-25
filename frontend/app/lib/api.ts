export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export const GITHUB_APP_SLUG =
  process.env.NEXT_PUBLIC_GITHUB_APP_SLUG ?? "asfalis-security-scanner";

export const GITHUB_INSTALL_URL = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`;
