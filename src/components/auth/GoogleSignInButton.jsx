import { useEffect, useRef, useState } from "react";

const SCRIPT_URL = "https://accounts.google.com/gsi/client";
let scriptPromise;
let initializedClientId;
let activeCallback;

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () => {
        if (window.google?.accounts?.id) resolve(window.google.accounts.id);
        else reject(new Error("Google Identity Services unavailable"));
      };
      script.onerror = () => {
        script.remove();
        reject(new Error("Google Identity Services failed to load"));
      };
      document.head.appendChild(script);
    }).catch((error) => {
      scriptPromise = undefined;
      throw error;
    });
  }
  return scriptPromise;
}

export default function GoogleSignInButton({ disabled, onCredential, onError }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  const containerRef = useRef(null);
  const callbackRef = useRef(onCredential);
  const errorRef = useRef(onError);
  const [status, setStatus] = useState(clientId ? "loading" : "missing");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    callbackRef.current = onCredential;
    errorRef.current = onError;
  }, [onCredential, onError]);

  useEffect(() => {
    if (!clientId) {
      console.warn("Google Sign-In chưa được cấu hình: thiếu VITE_GOOGLE_CLIENT_ID.");
      return undefined;
    }

    let cancelled = false;
    let observer;
    const handleResponse = (response) => {
      if (response?.credential) callbackRef.current(response.credential);
      else errorRef.current("Không nhận được xác thực Google. Vui lòng thử lại.");
    };

    loadGoogleIdentity()
      .then((googleId) => {
        if (cancelled) return;
        activeCallback = handleResponse;
        if (initializedClientId !== clientId) {
          googleId.initialize({
            client_id: clientId,
            callback: (response) => activeCallback?.(response),
            ux_mode: "popup",
            auto_select: false,
          });
          initializedClientId = clientId;
        }

        const container = containerRef.current;
        let previousWidth = 0;
        const render = () => {
          const width = Math.min(400, Math.floor(container.clientWidth));
          if (width < 200 || width === previousWidth) return;
          previousWidth = width;
          container.replaceChildren();
          googleId.renderButton(container, {
            type: "standard",
            theme: "outline",
            size: "large",
            text: "signin_with",
            shape: "pill",
            locale: "vi",
            width,
          });
        };
        render();
        observer = new ResizeObserver(render);
        observer.observe(container);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (activeCallback === handleResponse) activeCallback = undefined;
    };
  }, [clientId, retry]);

  if (!clientId) {
    return (
      <div className="space-y-2 text-center">
        <button type="button" disabled className="btn-secondary opacity-60">
          Tiếp tục với Google
        </button>
        <p className="text-label-md text-on-surface-variant">
          Đăng nhập Google chưa khả dụng.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <div
        ref={containerRef}
        aria-busy={status === "loading" || disabled}
        inert={status !== "ready" || disabled}
        className={`flex min-h-11 w-full items-center justify-center ${status !== "ready" || disabled ? "opacity-60" : ""}`}
      />
      {status === "loading" && (
        <p className="absolute inset-0 flex items-center justify-center text-body-md text-on-surface-variant">
          Đang tải đăng nhập Google...
        </p>
      )}
      {status === "error" && (
        <button
          type="button"
          onClick={() => {
            setStatus("loading");
            setRetry((value) => value + 1);
          }}
          className="btn-secondary absolute inset-0"
        >
          Không tải được Google. Thử lại
        </button>
      )}
    </div>
  );
}
