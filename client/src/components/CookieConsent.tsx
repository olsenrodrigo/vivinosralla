import { useEffect, useState } from "react";
import { setAnalyticsConfig, enableAnalytics, type AnalyticsConfig } from "@/lib/analytics";

const CONSENT_KEY = "wl_consent"; // "granted" | "denied"
const VISITOR_KEY = "wl_visitor";
/** Versão do texto do aviso. Muda quando o texto muda: o aceite é daquela versão. */
const POLICY_VERSION = "2026-08-11";

/**
 * Identificador anônimo de primeira visita, só para provar o aceite (REQ-7.2).
 * É gerado no navegador e nunca cruzado com pedido, cliente ou e-mail — se
 * fosse, o registro de consentimento viraria o rastreamento que ele documenta.
 */
function visitorId(): string {
  try {
    const atual = localStorage.getItem(VISITOR_KEY);
    if (atual) return atual;
    const novo = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, novo);
    return novo;
  } catch {
    // Sem localStorage não há como manter identidade entre visitas; um id
    // efêmero ainda registra que a escolha aconteceu.
    return crypto.randomUUID();
  }
}

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
    // Registra a escolha no servidor (REQ-7.2, REQ-7.3). A recusa é registrada
    // igual ao aceite: provar que a visitante disse não vale tanto quanto
    // provar que disse sim. Falha de rede não pode travar o banner — a decisão
    // local já vale, e insistir aqui atrapalharia a navegação.
    fetch("/api/store/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitorId: visitorId(),
        decision: granted ? "granted" : "denied",
        policyVersion: POLICY_VERSION,
      }),
    }).catch(() => {});

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
