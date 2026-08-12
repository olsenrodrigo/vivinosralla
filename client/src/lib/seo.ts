/**
 * Metatags por rota (REQ-5.1) e JSON-LD da peça (REQ-5.4).
 *
 * A loja é uma SPA: o `index.html` entregue tem as tags da marca, e cada rota
 * reescreve as suas ao montar. O Google executa JavaScript e lê o resultado;
 * crawlers que não executam ficam com as tags genéricas do documento — é o
 * limite conhecido de não haver renderização no servidor, registrado na spec.
 *
 * Toda tag criada aqui é marcada com `data-seo`, e a limpeza remove só essas:
 * as tags fixas do `index.html` nunca são tocadas.
 */

const MARCA = "VIVI NOSRALLA";

function definirMeta(seletor: string, attr: "name" | "property", chave: string, valor: string) {
  let el = document.head.querySelector<HTMLMetaElement>(seletor);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, chave);
    el.setAttribute("data-seo", "1");
    document.head.appendChild(el);
  }
  el.setAttribute("content", valor);
}

function definirCanonical(url: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    el.setAttribute("data-seo", "1");
    document.head.appendChild(el);
  }
  el.href = url;
}

export interface DadosSeo {
  titulo: string;
  descricao: string;
  /** Caminho da rota, sem origem. */
  caminho: string;
  imagem?: string | null;
  tipo?: "website" | "product" | "article";
}

export function aplicarSeo({ titulo, descricao, caminho, imagem, tipo = "website" }: DadosSeo): void {
  const url = `${window.location.origin}${caminho}`;
  const tituloCompleto = titulo.includes(MARCA) ? titulo : `${titulo} | ${MARCA}`;

  document.title = tituloCompleto;
  definirMeta('meta[name="description"]', "name", "description", descricao);
  definirCanonical(url);
  definirMeta('meta[property="og:title"]', "property", "og:title", tituloCompleto);
  definirMeta('meta[property="og:description"]', "property", "og:description", descricao);
  definirMeta('meta[property="og:url"]', "property", "og:url", url);
  definirMeta('meta[property="og:type"]', "property", "og:type", tipo);
  if (imagem) {
    const absoluta = imagem.startsWith("http") ? imagem : `${window.location.origin}${imagem}`;
    definirMeta('meta[property="og:image"]', "property", "og:image", absoluta);
    definirMeta('meta[name="twitter:image"]', "name", "twitter:image", absoluta);
  }
  definirMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
}

const ID_JSONLD = "jsonld-produto";

/**
 * JSON-LD `Product` da peça (REQ-5.4). `availability` sai do saldo real: marcar
 * InStock uma peça esgotada faz o Google anunciar o que a loja não entrega.
 */
export function aplicarJsonLdProduto(dados: {
  nome: string;
  descricao?: string | null;
  sku?: string | null;
  imagens: string[];
  preco: string | number;
  disponivel: boolean;
  caminho: string;
  marca?: string;
}): void {
  removerJsonLdProduto();
  const origem = window.location.origin;
  const bloco = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: dados.nome,
    description: dados.descricao || undefined,
    sku: dados.sku || undefined,
    image: dados.imagens.map(u => (u.startsWith("http") ? u : origem + u)),
    brand: { "@type": "Brand", name: dados.marca || MARCA },
    offers: {
      "@type": "Offer",
      url: origem + dados.caminho,
      price: String(dados.preco),
      priceCurrency: "BRL",
      availability: dados.disponivel
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = ID_JSONLD;
  script.textContent = JSON.stringify(bloco);
  document.head.appendChild(script);
}

export function removerJsonLdProduto(): void {
  document.getElementById(ID_JSONLD)?.remove();
}
