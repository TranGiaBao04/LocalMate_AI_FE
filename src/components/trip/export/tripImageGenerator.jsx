import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import boldFont from "../../../assets/fonts/be-vietnam-pro/BeVietnamPro-Bold.ttf";
import regularFont from "../../../assets/fonts/be-vietnam-pro/BeVietnamPro-Regular.ttf";
import semiBoldFont from "../../../assets/fonts/be-vietnam-pro/BeVietnamPro-SemiBold.ttf";
import TripInfographic, { TRIP_INFOGRAPHIC_WIDTH } from "./TripInfographic";

const FONT_SOURCES = [
  { source: regularFont, weight: 400 },
  { source: semiBoldFont, weight: 600 },
  { source: boldFont, weight: 700 },
];
let fontEmbedCssPromise;

const waitForPaint = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const getFontEmbedCss = () => {
  fontEmbedCssPromise ??= Promise.all(
    FONT_SOURCES.map(async ({ source, weight }) => {
      const response = await fetch(source);
      if (!response.ok) throw new Error("Could not load the export font.");
      const dataUrl = await blobToDataUrl(await response.blob());
      return `
        @font-face {
          font-family: "Be Vietnam Pro Export";
          src: url("${dataUrl}") format("truetype");
          font-style: normal;
          font-weight: ${weight};
        }
      `;
    }),
  ).then((fontFaces) => fontFaces.join("\n"));

  return fontEmbedCssPromise;
};

export async function generateTripImageBlob(trip) {
  if (typeof document === "undefined") {
    throw new Error("Image export requires a browser document.");
  }

  const container = document.createElement("div");
  container.setAttribute("aria-hidden", "true");
  Object.assign(container.style, {
    left: "-20000px",
    pointerEvents: "none",
    position: "fixed",
    top: "0",
    width: `${TRIP_INFOGRAPHIC_WIDTH}px`,
    zIndex: "-1",
  });
  document.body.appendChild(container);

  const root = createRoot(container);
  try {
    flushSync(() => root.render(<TripInfographic trip={trip} />));
    const [fontEmbedCSS] = await Promise.all([
      getFontEmbedCss(),
      document.fonts.load('400 30px "Be Vietnam Pro Export"'),
      document.fonts.load('600 30px "Be Vietnam Pro Export"'),
      document.fonts.load('700 30px "Be Vietnam Pro Export"'),
      document.fonts.ready,
    ]);
    await waitForPaint();

    const infographic = container.querySelector("[data-trip-infographic]");
    if (!infographic) throw new Error("Infographic did not render.");

    const height = Math.ceil(infographic.getBoundingClientRect().height);
    if (!height) throw new Error("Infographic has no measurable height.");

    const { toBlob } = await import("html-to-image");
    const blob = await toBlob(infographic, {
      backgroundColor: "#f4f6fa",
      cacheBust: true,
      canvasHeight: height,
      canvasWidth: TRIP_INFOGRAPHIC_WIDTH,
      fontEmbedCSS,
      height,
      pixelRatio: 1,
      preferredFontFormat: "truetype",
      skipAutoScale: true,
      width: TRIP_INFOGRAPHIC_WIDTH,
    });

    if (!blob || blob.type !== "image/png" || blob.size === 0) {
      throw new Error("PNG generation returned an invalid image.");
    }
    return blob;
  } finally {
    root.unmount();
    container.remove();
  }
}
