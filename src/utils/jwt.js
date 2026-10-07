import { getToken } from "./authStorage";

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return decodeURIComponent(
    atob(padded)
      .split("")
      .map((character) => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join(""),
  );
}

export function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") return null;

  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    return JSON.parse(decodeBase64Url(payload));
  } catch {
    return null;
  }
}

export function getStoredTokenPayload() {
  return decodeJwtPayload(getToken());
}

export function isStoredTokenExpired() {
  const expiresAt = getStoredTokenPayload()?.exp;
  return typeof expiresAt !== "number" || expiresAt * 1000 <= Date.now();
}
