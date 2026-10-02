const DEFAULT_STEM = "Lich-trinh";

export function toSafeFileStem(value, maxLength = 64) {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, maxLength)
    .replace(/-+$/g, "");

  if (!normalized) return DEFAULT_STEM;

  return normalized
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}

export function buildTripExportFileName({
  title,
  plannedDate,
  extension = "pdf",
}) {
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(plannedDate ?? "")
    ? `_${plannedDate}`
    : "";
  const safeExtension = String(extension)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") || "pdf";

  return `LocalMate_${toSafeFileStem(title)}${safeDate}.${safeExtension}`;
}

export function blobToFile(blob, fileName) {
  return new File([blob], fileName, {
    type: blob.type || "application/octet-stream",
    lastModified: Date.now(),
  });
}

export function downloadBlob(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export function canShareFile(file, browserNavigator = globalThis.navigator) {
  if (!file || !browserNavigator?.share || !browserNavigator?.canShare) {
    return false;
  }

  try {
    return browserNavigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export async function shareFile(
  file,
  { title = "Lịch trình LocalMate", text } = {},
  browserNavigator = globalThis.navigator,
) {
  if (!canShareFile(file, browserNavigator)) return false;

  await browserNavigator.share({
    files: [file],
    title,
    ...(text && { text }),
  });
  return true;
}
