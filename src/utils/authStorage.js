import { STORAGE_KEYS } from "../constants";

// Tab-scoped auth wins if legacy storage contains two different tokens.
export function getToken() {
  return sessionStorage.getItem(STORAGE_KEYS.TOKEN)
    || localStorage.getItem(STORAGE_KEYS.TOKEN);
}

export function removeToken() {
  sessionStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
}

export function setToken(token, remember = false) {
  removeToken();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(STORAGE_KEYS.TOKEN, token);
}
