import { useEffect, useState } from "react";
import { setAnalyticsConfig, enableAnalytics, type AnalyticsConfig } from "@/lib/analytics";

const CONSENT_KEY = "wl_consent"; // "granted" | "denied"

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#5B8C9B");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/store/settings")
      .then((r) => r.json())
      .then((s) => {
        if (cancelled) return;
        if (s?.primaryColor) setPrimaryColor(s.primaryColor);
        const ac = (s?.analyticsConfig ?? {}) as AnalyticsConfig;
        setAnalyticsConfig(ac);
        const hasAnyPixel = !!(ac.ga4MeasurementId || ac.metaPixelId || ac.tiktokPixelId);
        if (!hasAnyPixel) return; // nada a medir → sem banner, sem scripts

        const decision = (() => {
          try {
            return localStorage.getItem(CONSENT_KEY);
          } catch {
            return null;
          }
        })();

        if (ac.requireConsent === false) {
          enableAnalytics();
          return;
        }
        if (decision === "granted") enableAnalytics();
        else if (decision !== "denied") setVisible(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const decide = (granted: boolean) => {
    try {
      localStorage.setItem(CONSENT_KEY, granted ? "granted" : "denied");
    } catch {
      /* ignore */
    }
    if (granted) enableAnalytics();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Privacidade"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-gray-200 bg-white/95 backdrop-blur px-4 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm leading-relaxed text-gray-600">
          Usamos cookies e pixels de análise para entender como a loja é usada e melhorar sua
          experiência. Você pode aceitar ou recusar — só carregamos essas ferramentas com o seu
          consentimento.
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => decide(false)}
            className="rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Recusar
          </button>
          <button
            type="button"
            onClick={() => decide(true)}
            className="rounded-full px-5 py-2 text-sm font-semibold text-white"
            style={{ background: primaryColor }}
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}
