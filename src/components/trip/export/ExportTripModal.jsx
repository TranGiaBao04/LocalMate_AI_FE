import { useEffect, useMemo, useRef, useState } from "react";
import {
  blobToFile,
  buildTripExportFileName,
  canShareFile,
  downloadBlob,
  shareFile,
} from "../../../utils/exportFiles";
import { normalizeTripForExport } from "../../../utils/tripExportMapper";

export default function ExportTripModal({ open, onClose, trip }) {
  const [pdfStatus, setPdfStatus] = useState("idle");
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfShareSupported, setPdfShareSupported] = useState(false);
  const [imageStatus, setImageStatus] = useState("idle");
  const [imageFile, setImageFile] = useState(null);
  const [imageShareSupported, setImageShareSupported] = useState(false);
  const generationInFlight = useRef(null);
  const exportTrip = useMemo(
    () => (open && trip ? normalizeTripForExport(trip) : null),
    [open, trip],
  );
  const isGenerating =
    pdfStatus === "generating" || imageStatus === "generating";

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (
        event.key === "Escape" &&
        !generationInFlight.current &&
        !isGenerating
      ) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGenerating, onClose, open]);

  if (!open || !exportTrip) return null;

  const createFile = (blob, extension) =>
    blobToFile(
      blob,
      buildTripExportFileName({
        extension,
        plannedDate: exportTrip.plannedDate,
        title: exportTrip.title,
      }),
    );

  const handleGeneratePdf = async () => {
    if (generationInFlight.current) return;
    generationInFlight.current = "pdf";
    setPdfStatus("generating");
    setPdfFile(null);
    setPdfShareSupported(false);

    try {
      const { generateTripPdfBlob } = await import("./tripPdfGenerator");
      const file = createFile(await generateTripPdfBlob(exportTrip), "pdf");
      setPdfFile(file);
      setPdfShareSupported(canShareFile(file));
      setPdfStatus("ready");
    } catch {
      setPdfStatus("error");
    } finally {
      generationInFlight.current = null;
    }
  };

  const handleGenerateImage = async () => {
    if (generationInFlight.current) return;
    generationInFlight.current = "image";
    setImageStatus("generating");
    setImageFile(null);
    setImageShareSupported(false);

    try {
      const { generateTripImageBlob } = await import("./tripImageGenerator");
      const file = createFile(await generateTripImageBlob(exportTrip), "png");
      setImageFile(file);
      setImageShareSupported(canShareFile(file));
      setImageStatus("ready");
    } catch {
      setImageStatus("error");
    } finally {
      generationInFlight.current = null;
    }
  };

  const handlePdfAction = () => {
    if (pdfStatus === "ready" && pdfFile) {
      downloadBlob(pdfFile, pdfFile.name);
      return;
    }
    handleGeneratePdf();
  };

  const handleImageAction = () => {
    if (imageStatus === "ready" && imageFile) {
      downloadBlob(imageFile, imageFile.name);
      return;
    }
    handleGenerateImage();
  };

  const handleShare = async (file, setStatus) => {
    if (!file) return;
    try {
      await shareFile(file, {
        text: "Lịch trình được tạo bởi LocalMate AI.",
        title: exportTrip.title ?? "Lịch trình LocalMate",
      });
    } catch (error) {
      if (error?.name !== "AbortError") setStatus("error");
    }
  };

  const pdfActionLabel = {
    error: "Thử lại",
    generating: "Đang tạo PDF...",
    idle: "Tạo PDF",
    ready: "Tải PDF",
  }[pdfStatus];
  const imageActionLabel = {
    error: "Thử lại",
    generating: "Đang tạo ảnh...",
    idle: "Tạo ảnh",
    ready: "Tải ảnh",
  }[imageStatus];

  return (
    <div
      aria-labelledby="export-trip-title"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 lg:items-center lg:p-6"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !generationInFlight.current &&
          !isGenerating
        ) {
          onClose();
        }
      }}
      role="dialog"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-lg bg-surface px-container-margin pb-8 pt-3 shadow-2xl lg:rounded-lg lg:p-8">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-outline-variant lg:hidden" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              className="text-headline-lg-mobile font-bold text-on-surface lg:text-headline-lg"
              id="export-trip-title"
            >
              Xuất lịch trình
            </h2>
            <p className="mt-1 text-body-md text-on-surface-variant">
              Chọn cách bạn muốn lưu hoặc mang theo lịch trình.
            </p>
          </div>
          <button
            aria-label="Đóng cửa sổ xuất lịch trình"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-40"
            disabled={isGenerating}
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          <article className="flex min-h-56 flex-col rounded-lg border-2 border-primary bg-surface-container-lowest p-5 shadow-sm">
            <span className="material-symbols-outlined text-[30px] text-primary">
              picture_as_pdf
            </span>
            <h3 className="mt-4 text-title-md font-bold text-on-surface">
              Tài liệu PDF
            </h3>
            <p className="mt-2 flex-1 text-body-md text-on-surface-variant">
              Dễ lưu, in và gửi cho người thân.
            </p>
            <button
              className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-button text-on-primary transition-transform active:scale-95 disabled:cursor-wait disabled:opacity-60"
              disabled={isGenerating}
              onClick={handlePdfAction}
              type="button"
            >
              {pdfStatus === "generating" && (
                <span className="material-symbols-outlined animate-spin text-[20px]">
                  progress_activity
                </span>
              )}
              {pdfStatus === "ready" && (
                <span className="material-symbols-outlined text-[20px]">
                  download
                </span>
              )}
              {pdfActionLabel}
            </button>
            {pdfStatus === "ready" && pdfShareSupported && (
              <button
                className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-primary px-4 py-2.5 text-button text-primary transition-colors hover:bg-primary/5"
                onClick={() => handleShare(pdfFile, setPdfStatus)}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">share</span>
                Chia sẻ
              </button>
            )}
            {pdfStatus === "error" && (
              <p className="mt-3 text-label-md text-error" role="alert">
                Không thể tạo PDF. Vui lòng thử lại.
              </p>
            )}
          </article>

          <article className="flex min-h-56 flex-col rounded-lg border-2 border-secondary bg-surface-container-lowest p-5 shadow-sm">
            <span className="material-symbols-outlined text-[30px] text-secondary">
              image
            </span>
            <h3 className="mt-4 text-title-md font-bold text-on-surface">
              Ảnh lịch trình
            </h3>
            <p className="mt-2 flex-1 text-body-md text-on-surface-variant">
              Phù hợp để lưu vào điện thoại hoặc gửi qua Zalo, Messenger.
            </p>
            <button
              className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-button text-on-secondary transition-transform active:scale-95 disabled:cursor-wait disabled:opacity-60"
              disabled={isGenerating}
              onClick={handleImageAction}
              type="button"
            >
              {imageStatus === "generating" && (
                <span className="material-symbols-outlined animate-spin text-[20px]">
                  progress_activity
                </span>
              )}
              {imageStatus === "ready" && (
                <span className="material-symbols-outlined text-[20px]">
                  download
                </span>
              )}
              {imageActionLabel}
            </button>
            {imageStatus === "ready" && imageShareSupported && (
              <button
                className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-secondary px-4 py-2.5 text-button text-secondary transition-colors hover:bg-secondary/5"
                onClick={() => handleShare(imageFile, setImageStatus)}
                type="button"
              >
                <span className="material-symbols-outlined text-[20px]">share</span>
                Chia sẻ
              </button>
            )}
            {imageStatus === "error" && (
              <p className="mt-3 text-label-md text-error" role="alert">
                Không thể tạo ảnh. Vui lòng thử lại.
              </p>
            )}
          </article>

          <article
            aria-disabled="true"
            className="flex min-h-56 flex-col rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5 opacity-75"
          >
            <span className="material-symbols-outlined text-[30px] text-on-surface-variant">
              calendar_month
            </span>
            <h3 className="mt-4 text-title-md font-bold text-on-surface">
              Thêm vào lịch
            </h3>
            <p className="mt-2 flex-1 text-body-md text-on-surface-variant">
              Nhận nhắc nhở theo từng điểm đến.
            </p>
            <span className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-surface-container-high px-4 py-2.5 text-button text-on-surface-variant">
              Sắp có
            </span>
          </article>
        </div>
      </div>
    </div>
  );
}
