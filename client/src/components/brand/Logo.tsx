/**
 * Logomarca VIVI NOSRALLA.
 *
 * Os SVGs em `public/brand/` foram vetorizados do brandbook oficial
 * (insumos/ID VISUAL VIVI NOSRALLA +.pdf) — a marca nunca é recomposta com
 * webfont, porque a Dream Avenue original é licenciada.
 *
 *  - `lockup`  monograma "vn" + assinatura VIVIANE NOSRALLA (cabeçalho)
 *  - `icone`   só o monograma "vn" (rodapé, favicon, selos)
 */

type Tom = "oliva" | "gelo" | "vinho";

const ARQUIVO: Record<"lockup" | "icone", Record<Tom, string>> = {
  lockup: {
    oliva: "/brand/logo-vn-oliva.svg",
    gelo: "/brand/logo-vn-gelo.svg",
    vinho: "/brand/logo-vn-vinho.svg",
  },
  icone: {
    oliva: "/brand/icone-vn-oliva.svg",
    gelo: "/brand/icone-vn-gelo.svg",
    vinho: "/brand/icone-vn-vinho.svg",
  },
};

interface LogoProps {
  variante?: "lockup" | "icone";
  tom?: Tom;
  className?: string;
  /** Marque quando houver outro texto acessível ao lado (evita leitura duplicada). */
  decorativo?: boolean;
}

export default function Logo({
  variante = "lockup",
  tom = "oliva",
  className = "h-10",
  decorativo = false,
}: LogoProps) {
  return (
    <img
      src={ARQUIVO[variante][tom]}
      alt={decorativo ? "" : "Viviane Nosralla"}
      aria-hidden={decorativo || undefined}
      className={`${className} w-auto object-contain`}
      draggable={false}
    />
  );
}
