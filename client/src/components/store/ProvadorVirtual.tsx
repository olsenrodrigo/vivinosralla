import { useEffect, useRef, useState } from "react";
import { Sparkles, Info, Trash2, RefreshCw, X } from "lucide-react";
import { useCart } from "@/context/CartContext";

/**
 * Provador Virtual na página da peça.
 *
 * Duas coisas que a tela precisa fazer bem, e que não são detalhe de layout:
 * o termo de consentimento aparece ANTES do seletor de arquivo (a cliente
 * decide informada, não depois de já ter escolhido a foto), e o resultado sai
 * rotulado como simulação sem exigir clique nenhum — cliente que compra achando
 * que é foto real devolve a peça.
 */

/** Versão do termo aceito. Muda quando o texto muda: é o que fica registrado. */
const TERMO_VERSAO = "v2026-08";
const RETENCAO_FOTO = "24 horas";
const RETENCAO_RESULTADO = "7 dias";

type Estado =
  | { etapa: "fechado" }
  | { etapa: "termo" }
  | { etapa: "enviando" }
  | { etapa: "aguardando"; provaToken: string }
  | { etapa: "pronto"; provaToken: string }
  | { etapa: "erro"; mensagem: string; recusada: boolean };

interface Props {
  productId: number;
  variantId?: number | null;
  /** Rótulo da cor escolhida, só para o texto da tela. */
  corLabel?: string | null;
}

export default function ProvadorVirtual({ productId, variantId, corLabel }: Props) {
  const { sessionId } = useCart();
  const [ligado, setLigado] = useState(false);
  const [estado, setEstado] = useState<Estado>({ etapa: "fechado" });
  const [aceite, setAceite] = useState(false);
  const [maioridade, setMaioridade] = useState(false);
  const [fotoToken, setFotoToken] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<number | null>(null);

  // REQ-5.5: sem o recurso ligado, o botão não existe na página.
  useEffect(() => {
    fetch("/api/store/settings")
      .then((r) => r.json())
      .then((s) => setLigado(Boolean(s?.tryonEnabled)))
      .catch(() => setLigado(false));
  }, []);

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  function acompanhar(provaToken: string) {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      try {
        const r = await fetch(`/api/provador/prova/${provaToken}`);
        if (!r.ok) throw new Error("nao_encontrado");
        const d = await r.json();
        if (d.status === "concluida") {
          window.clearInterval(pollRef.current!);
          setEstado({ etapa: "pronto", provaToken });
        } else if (d.status === "falhou" || d.status === "recusada") {
          window.clearInterval(pollRef.current!);
          setEstado({
            etapa: "erro",
            recusada: d.status === "recusada",
            mensagem: d.status === "recusada"
              ? "Não consegui identificar você na foto."
              : "A prova não pôde ser gerada agora.",
          });
        }
      } catch {
        window.clearInterval(pollRef.current!);
        setEstado({ etapa: "erro", recusada: false, mensagem: "A prova não pôde ser gerada agora.", });
      }
    }, 3000);
  }

  async function pedirProva(token: string) {
    const r = await fetch(`/api/provador/${sessionId}/prova`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fotoToken: token, productId, variantId: variantId ?? undefined }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setEstado({ etapa: "erro", recusada: false, mensagem: mensagemDeErro(d?.error) });
      return;
    }
    const d = await r.json();
    setEstado({ etapa: "aguardando", provaToken: d.provaToken });
    acompanhar(d.provaToken);
  }

  async function enviarFoto(file: File) {
    setEstado({ etapa: "enviando" });
    const fd = new FormData();
    fd.append("file", file);
    fd.append("consentimento", "aceito");
    fd.append("maioridade", "sim");
    fd.append("termoVersao", TERMO_VERSAO);
    const r = await fetch(`/api/provador/${sessionId}/foto`, { method: "POST", body: fd });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setEstado({ etapa: "erro", recusada: false, mensagem: mensagemDeErro(d?.error) });
      return;
    }
    const d = await r.json();
    setFotoToken(d.fotoToken);
    await pedirProva(d.fotoToken);
  }

  async function apagarMinhaFoto() {
    if (!fotoToken) return;
    await fetch(`/api/provador/${sessionId}/foto/${fotoToken}`, { method: "DELETE" });
    setFotoToken(null);
    setAceite(false);
    setMaioridade(false);
    setEstado({ etapa: "fechado" });
  }

  if (!ligado) return null;

  // REQ-3.8: com foto válida na sessão, trocar a cor gera nova prova sem novo
  // upload e sem repetir o aceite — o termo cobre a sessão de prova, não a peça.
  const podeReprovar = Boolean(fotoToken) && estado.etapa !== "aguardando" && estado.etapa !== "enviando";

  return (
    <div className="mt-6 border border-vn-olive-200 bg-vn-olive-50/40 p-4">
      <div className="flex items-start gap-3">
        <Sparkles size={18} className="mt-0.5 shrink-0 text-vn-olive-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="font-sans text-sm font-semibold text-vn-ink">Provar em mim</h3>
          <p className="mt-0.5 text-sm text-vn-ink-soft">
            Envie uma foto sua de corpo inteiro e veja uma simulação da peça em você.
          </p>

          {estado.etapa === "fechado" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setEstado({ etapa: "termo" })} className="btn-line text-sm">
                {fotoToken ? "Provar esta cor" : "Provar em mim"}
              </button>
              {podeReprovar && (
                <button type="button" onClick={() => fotoToken && pedirProva(fotoToken)} className="btn-line text-sm">
                  <RefreshCw size={14} aria-hidden /> Usar a mesma foto
                </button>
              )}
            </div>
          )}

          {estado.etapa === "termo" && (
            <div className="mt-3 space-y-3 border border-vn-olive-200 bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-sans text-sm font-semibold text-vn-ink">Antes de enviar sua foto</h4>
                <button type="button" onClick={() => setEstado({ etapa: "fechado" })}
                  className="text-vn-ink-soft hover:text-vn-ink" aria-label="Fechar">
                  <X size={16} aria-hidden />
                </button>
              </div>

              {/* REQ-4.5: as orientações de foto vêm ANTES do seletor de arquivo. */}
              <div className="flex gap-2 bg-vn-olive-50 p-3 text-sm text-vn-ink-soft">
                <Info size={15} className="mt-0.5 shrink-0 text-vn-olive-600" aria-hidden />
                <p>
                  Use uma foto <strong>de corpo inteiro</strong>, com <strong>uma pessoa só</strong>,
                  boa iluminação e fundo liso. É o que dá o melhor resultado.
                </p>
              </div>

              {/* REQ-1.1: finalidade, provedor, prazos e direito de exclusão. */}
              <div className="space-y-1.5 text-xs leading-relaxed text-vn-ink-soft">
                <p>
                  Sua foto é usada <strong>somente</strong> para gerar esta simulação. Ela é enviada a um
                  serviço de inteligência artificial parceiro, que pode processá-la fora do Brasil.
                </p>
                <p>
                  A foto é apagada em até <strong>{RETENCAO_FOTO}</strong> e a simulação em até{" "}
                  <strong>{RETENCAO_RESULTADO}</strong>. Você pode apagar as duas a qualquer momento,
                  aqui mesmo. Sua foto <strong>não</strong> vai para o catálogo, não fica visível para
                  a loja e não é usada para treinar modelos.
                </p>
              </div>

              {/* REQ-1.2: duas marcações independentes. */}
              <label className="flex cursor-pointer items-start gap-2 text-sm text-vn-ink">
                <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-vn-olive-600" />
                <span>Concordo com o tratamento da minha foto para gerar a simulação.</span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-sm text-vn-ink">
                <input type="checkbox" checked={maioridade} onChange={(e) => setMaioridade(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-vn-olive-600" />
                <span>Tenho 18 anos ou mais e sou a pessoa que aparece na foto.</span>
              </label>

              <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void enviarFoto(f); }} />
              <button type="button" disabled={!aceite || !maioridade}
                onClick={() => inputRef.current?.click()}
                className="btn-ink w-full text-sm disabled:cursor-not-allowed disabled:opacity-40">
                Escolher minha foto
              </button>
            </div>
          )}

          {(estado.etapa === "enviando" || estado.etapa === "aguardando") && (
            <div className="mt-3 flex items-center gap-3 border border-vn-olive-200 bg-card p-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-vn-olive-600 border-t-transparent" aria-hidden />
              <p className="text-sm text-vn-ink-soft">
                {estado.etapa === "enviando" ? "Enviando sua foto…" : "Gerando sua simulação — leva até 60 segundos."}
              </p>
            </div>
          )}

          {estado.etapa === "pronto" && (
            <figure className="mt-3">
              <img src={`/api/provador/resultado/${estado.provaToken}`}
                alt="Simulação da peça em você, gerada por inteligência artificial"
                className="w-full max-w-xs border border-vn-olive-200 bg-vn-olive-50" />
              {/* REQ-3.3: o rótulo é visível sem nenhuma interação. */}
              <figcaption className="mt-1.5 max-w-xs text-xs text-vn-ink-soft">
                Simulação gerada por IA — o caimento real pode variar.
                {corLabel ? ` Cor provada: ${corLabel}.` : ""}
              </figcaption>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => setEstado({ etapa: "fechado" })} className="btn-line text-sm">
                  Provar outra cor
                </button>
                <button type="button" onClick={apagarMinhaFoto}
                  className="text-sm text-vn-ink-soft underline underline-offset-4 hover:text-vn-wine">
                  <Trash2 size={13} className="mr-1 inline" aria-hidden /> Apagar minha foto
                </button>
              </div>
            </figure>
          )}

          {estado.etapa === "erro" && (
            <div className="mt-3 border border-vn-olive-200 bg-card p-4">
              <p className="text-sm text-vn-ink">{estado.mensagem}</p>
              {estado.recusada && (
                <p className="mt-1 text-sm text-vn-ink-soft">
                  Tente uma foto de corpo inteiro, com uma pessoa só e fundo liso.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {/* REQ-4.3: tentar de novo reaproveita a foto, sem novo upload. */}
                {fotoToken && (
                  <button type="button" onClick={() => fotoToken && pedirProva(fotoToken)} className="btn-line text-sm">
                    <RefreshCw size={14} aria-hidden /> Tentar de novo
                  </button>
                )}
                <button type="button" onClick={() => setEstado({ etapa: "termo" })} className="btn-line text-sm">
                  Enviar outra foto
                </button>
                {fotoToken && (
                  <button type="button" onClick={apagarMinhaFoto}
                    className="text-sm text-vn-ink-soft underline underline-offset-4 hover:text-vn-wine">
                    Apagar minha foto
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function mensagemDeErro(codigo?: string): string {
  switch (codigo) {
    case "formato_invalido": return "Envie uma imagem JPEG, PNG ou WebP.";
    case "arquivo_muito_grande": return "A foto precisa ter no máximo 10 MB.";
    case "limite_de_provas": return "Você fez muitas provas agora há pouco. Tente de novo mais tarde.";
    case "limite_diario_atingido": return "Você atingiu o limite de provas de hoje.";
    case "prova_em_andamento": return "Já existe uma prova em andamento. Aguarde ela terminar.";
    case "teto_de_provas_atingido": return "O provador atingiu o limite deste mês.";
    case "peca_sem_foto": return "Esta peça ainda não tem foto para a prova.";
    default: return "A prova não pôde ser gerada agora.";
  }
}
