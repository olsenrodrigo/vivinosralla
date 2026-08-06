/**
 * Catálogo inicial da loja VIVI NOSRALLA.
 *
 * As fotos vêm do acervo do Instagram da marca (@vivianenosralla) e ficam em
 * `uploads/produtos/`. São imagens de referência para a loja sair do zero —
 * antes do go-live devem ser trocadas por fotos de estúdio no padrão 3:4.
 *
 * Convenção de variantes: option1 = Tamanho, option2 = Cor.
 */

export type Cor = {
  nome: string;
  hex: string;
};

/** Paleta de cores do catálogo — alimenta os swatches da vitrine. */
export const CORES: Record<string, string> = {
  "Off-white": "#f1efe6",
  Areia: "#d9cfba",
  Oliva: "#878f79",
  "Verde-militar": "#5a6148",
  Vinho: "#6b2336",
  "Rosa-seco": "#c79ba2",
  Caramelo: "#a5713d",
  Marrom: "#6b4a35",
  "Azul-marinho": "#232f43",
  "Azul-claro": "#8fa8bf",
  Cinza: "#9b9b98",
  Preto: "#1e1e1c",
  Vermelho: "#b8342e",
  Amarelo: "#e0c063",
  Dourado: "#b39355",
};

export const CATEGORIAS = [
  {
    slug: "vestidos",
    name: "Vestidos",
    description: "Do trabalho ao jantar — midi, longos e curtos que resolvem o dia inteiro.",
    imagem: "vn-16.webp",
  },
  {
    slug: "conjuntos",
    name: "Conjuntos",
    description: "Look pronto em duas peças. Combina fácil, veste bem, não erra.",
    imagem: "vn-03.webp",
  },
  {
    slug: "alfaiataria",
    name: "Alfaiataria",
    description: "Blazers, coletes e sobreposições que estruturam qualquer produção.",
    imagem: "vn-07.webp",
  },
  {
    slug: "blusas",
    name: "Blusas & Camisas",
    description: "A base do guarda-roupa: camisaria, blusas de festa e peças de todo dia.",
    imagem: "vn-14.webp",
  },
  {
    slug: "trico",
    name: "Tricô",
    description: "Fios macios para a meia-estação e o inverno do interior.",
    imagem: "vn-13.webp",
  },
  {
    slug: "calcas-saias",
    name: "Calças & Saias",
    description: "Pantalonas, wide leg e midis com o caimento certo.",
    imagem: "vn-25.webp",
  },
] as const;

export type ProdutoSeed = {
  slug: string;
  titulo: string;
  categoria: string;
  preco: number;
  precoDe?: number;
  cores: string[];
  tamanhos: string[];
  imagens: string[];
  descricao: string;
  composicao: string;
  tags: string[];
  destaque?: boolean;
  pesoG: number;
};

const PADRAO = ["PP", "P", "M", "G", "GG"];

export const PRODUTOS: ProdutoSeed[] = [
  // ─── Vestidos ──────────────────────────────────────────────────────────────
  {
    slug: "vestido-colete-marta",
    titulo: "Vestido Colete Marta",
    categoria: "vestidos",
    preco: 329,
    cores: ["Caramelo", "Preto"],
    tamanhos: PADRAO,
    imagens: ["vn-16.webp"],
    descricao:
      "Vestido colete de abotoamento frontal e saia com leve rodado. Use sozinho no calor ou sobre camisa branca quando esfriar — dois looks na mesma peça.",
    composicao: "Sarja de viscose com elastano. Forro nas costas. Lavar à mão ou ciclo delicado.",
    tags: ["novidades", "trabalho", "dia-a-dia"],
    destaque: true,
    pesoG: 420,
  },
  {
    slug: "vestido-midi-floral-clarice",
    titulo: "Vestido Midi Floral Clarice",
    categoria: "vestidos",
    preco: 349,
    cores: ["Vinho"],
    tamanhos: PADRAO,
    imagens: ["vn-12.webp"],
    descricao:
      "Midi de alças finas em estampa floral sobre fundo vinho, com babados sobrepostos na barra. Cai bem com rasteira de dia e salto à noite.",
    composicao: "Viscose leve. Forro interno. Não usar alvejante.",
    tags: ["novidades", "festa"],
    destaque: true,
    pesoG: 380,
  },
  {
    slug: "vestido-amelia-listrado",
    titulo: "Vestido Amélia Listrado",
    categoria: "vestidos",
    preco: 279,
    cores: ["Azul-claro"],
    tamanhos: PADRAO,
    imagens: ["vn-17.webp"],
    descricao:
      "Chemise ampla em listras finas, decote V com amarração e tassels bordados nos punhos. Fresco, leve e confortável do começo ao fim do dia.",
    composicao: "100% algodão fio tinto. Lavar à máquina em ciclo suave.",
    tags: ["novidades", "dia-a-dia", "verao"],
    pesoG: 340,
  },
  {
    slug: "vestido-longo-sofia",
    titulo: "Vestido Longo Sofia",
    categoria: "vestidos",
    preco: 429,
    cores: ["Amarelo"],
    tamanhos: PADRAO,
    imagens: ["vn-19.webp"],
    descricao:
      "Longo de alças com saia em camadas e caimento fluido. A peça certa para casamento, formatura e réveillon.",
    composicao: "Crepe de viscose. Forro completo. Lavar a seco.",
    tags: ["festa"],
    destaque: true,
    pesoG: 520,
  },
  {
    slug: "vestido-tubinho-bia",
    titulo: "Vestido Tubinho Bia",
    categoria: "vestidos",
    preco: 269,
    precoDe: 319,
    cores: ["Rosa-seco"],
    tamanhos: PADRAO,
    imagens: ["vn-21.webp"],
    descricao:
      "Tubinho de alças finas com franzido lateral que valoriza a silhueta sem apertar. Malha encorpada que não marca.",
    composicao: "Malha canelada com elastano. Lavar do avesso.",
    tags: ["festa", "promocao"],
    pesoG: 300,
  },
  {
    slug: "vestido-midi-julia",
    titulo: "Vestido Midi Julia",
    categoria: "vestidos",
    preco: 299,
    cores: ["Azul-claro"],
    tamanhos: PADRAO,
    imagens: ["vn-23.webp"],
    descricao:
      "Midi de alças com busto drapeado e saia ampla em listras finas. Elegante o suficiente para um almoço de família e confortável para o dia todo.",
    composicao: "Tricoline de algodão. Bojo removível. Ciclo delicado.",
    tags: ["novidades", "dia-a-dia"],
    pesoG: 360,
  },
  {
    slug: "vestido-longo-rita",
    titulo: "Vestido Longo Rita",
    categoria: "vestidos",
    preco: 359,
    cores: ["Rosa-seco"],
    tamanhos: PADRAO,
    imagens: ["vn-26.webp"],
    descricao:
      "Longo soltinho de gola alta e cava ampla, em algodão encorpado. Do café da manhã ao fim de tarde, sem amassar.",
    composicao: "Algodão poplin. Lavar à máquina, secar à sombra.",
    tags: ["dia-a-dia", "verao"],
    pesoG: 480,
  },
  {
    slug: "vestido-laise-vitoria",
    titulo: "Vestido Laise Vitória",
    categoria: "vestidos",
    preco: 389,
    cores: ["Preto"],
    tamanhos: PADRAO,
    imagens: ["vn-28.webp"],
    descricao:
      "Laise trabalhada, gola alta e manga bufante curta. Um preto que não é básico — resolve casamento à tarde e jantar à noite.",
    composicao: "Laise de algodão com forro. Lavar à mão.",
    tags: ["festa", "novidades"],
    destaque: true,
    pesoG: 400,
  },
  {
    slug: "vestido-longo-dora",
    titulo: "Vestido Longo Estampado Dora",
    categoria: "vestidos",
    preco: 399,
    cores: ["Rosa-seco"],
    tamanhos: PADRAO,
    imagens: ["vn-29.webp"],
    descricao:
      "Manga longa, gola alta e franzido frontal em estampa exclusiva. Cobre e valoriza ao mesmo tempo — favorito de quem quer elegância sem decote.",
    composicao: "Malha de viscose com toque de seda. Lavar do avesso.",
    tags: ["festa"],
    pesoG: 420,
  },
  {
    slug: "vestido-curto-ivone",
    titulo: "Vestido Curto Ivone",
    categoria: "vestidos",
    preco: 319,
    cores: ["Cinza"],
    tamanhos: PADRAO,
    imagens: ["vn-30.webp"],
    descricao:
      "Tomara que caia estruturado em tecido com fio metalizado. Brilho na medida para festa de fim de ano.",
    composicao: "Jacquard com lurex. Bojo estruturado. Lavar a seco.",
    tags: ["festa"],
    pesoG: 340,
  },

  // ─── Conjuntos ─────────────────────────────────────────────────────────────
  {
    slug: "conjunto-alfaiataria-beatriz",
    titulo: "Conjunto Alfaiataria Beatriz",
    categoria: "conjuntos",
    preco: 529,
    precoDe: 619,
    cores: ["Areia"],
    tamanhos: PADRAO,
    imagens: ["vn-03.webp"],
    descricao:
      "Blazer de botões joia e calça de alfaiataria em linho misto. Um look inteiro resolvido para trabalho, evento e viagem.",
    composicao: "Linho com viscose. Blazer forrado. Lavar a seco.",
    tags: ["novidades", "trabalho", "promocao"],
    destaque: true,
    pesoG: 900,
  },
  {
    slug: "conjunto-peplum-eloa",
    titulo: "Conjunto Peplum Eloá",
    categoria: "conjuntos",
    preco: 389,
    cores: ["Oliva"],
    tamanhos: PADRAO,
    imagens: ["vn-05.webp"],
    descricao:
      "Top peplum e saia longa no mesmo tom oliva, em tecido com textura acetinada. Vende junto, veste separado.",
    composicao: "Viscose com textura. Forro na saia. Ciclo delicado.",
    tags: ["novidades", "festa"],
    destaque: true,
    pesoG: 560,
  },
  {
    slug: "conjunto-comfy-nina",
    titulo: "Conjunto Comfy Nina",
    categoria: "conjuntos",
    preco: 349,
    cores: ["Areia"],
    tamanhos: PADRAO,
    imagens: ["vn-08.webp"],
    descricao:
      "Moletom de gola careca e calça de cós elástico em algodão pesado. Conforto de casa com cara de produção pensada.",
    composicao: "Moletinho de algodão peletizado. Lavar do avesso.",
    tags: ["dia-a-dia", "inverno"],
    pesoG: 780,
  },
  {
    slug: "conjunto-vitoria-vermelho",
    titulo: "Conjunto Vitória",
    categoria: "conjuntos",
    preco: 359,
    cores: ["Vermelho"],
    tamanhos: PADRAO,
    imagens: ["vn-18.webp"],
    descricao:
      "Regata de ombro estruturado e short de alfaiataria em vermelho fechado. Conjunto de verão com pegada de alfaiataria.",
    composicao: "Linho misto. Short forrado. Lavar à mão.",
    tags: ["verao", "novidades"],
    pesoG: 420,
  },
  {
    slug: "conjunto-peplum-alice",
    titulo: "Conjunto Peplum Alice",
    categoria: "conjuntos",
    preco: 419,
    cores: ["Vermelho"],
    tamanhos: PADRAO,
    imagens: ["vn-20.webp"],
    descricao:
      "Top de alças com amarração e peplum, com calça de alfaiataria combinando. Para quando a ocasião pede cor.",
    composicao: "Crepe de viscose. Forro no top. Lavar a seco.",
    tags: ["festa"],
    pesoG: 540,
  },
  {
    slug: "conjunto-isadora",
    titulo: "Conjunto Isadora",
    categoria: "conjuntos",
    preco: 449,
    cores: ["Off-white"],
    tamanhos: PADRAO,
    imagens: ["vn-22.webp"],
    descricao:
      "Blusa de babados e calça ampla em tecido fluido off-white. Um branco de verão que cai bem em qualquer idade.",
    composicao: "Viscose leve. Calça com forro. Lavar à mão.",
    tags: ["verao", "novidades"],
    pesoG: 480,
  },
  {
    slug: "conjunto-carol",
    titulo: "Conjunto Short Carol",
    categoria: "conjuntos",
    preco: 299,
    cores: ["Azul-claro"],
    tamanhos: PADRAO,
    imagens: ["vn-24.webp"],
    descricao:
      "Camisa de amarração e short de cintura alta em linho azul-claro. Confortável para o calor sem abrir mão do acabamento.",
    composicao: "Linho com algodão. Lavar à máquina em ciclo suave.",
    tags: ["verao"],
    pesoG: 380,
  },
  {
    slug: "conjunto-poa-cecilia",
    titulo: "Conjunto Poá Cecília",
    categoria: "conjuntos",
    preco: 429,
    cores: ["Off-white"],
    tamanhos: PADRAO,
    imagens: ["vn-27.webp"],
    descricao:
      "Blusa de gola alta sem manga e calça pantalona em poá clássico, com faixa na cintura. Atemporal de verdade.",
    composicao: "Musseline de viscose. Forro no busto e na calça. Lavar a seco.",
    tags: ["festa", "trabalho"],
    pesoG: 460,
  },

  // ─── Alfaiataria ───────────────────────────────────────────────────────────
  {
    slug: "blazer-regina",
    titulo: "Blazer Alfaiataria Regina",
    categoria: "alfaiataria",
    preco: 419,
    cores: ["Azul-marinho"],
    tamanhos: PADRAO,
    imagens: ["vn-02.webp"],
    descricao:
      "Blazer de corte solto e ombro leve, comprimento que cobre o quadril. Feito para vestir bem em todos os corpos e idades.",
    composicao: "Sarja de viscose. Forro acetinado. Lavar a seco.",
    tags: ["trabalho", "novidades"],
    destaque: true,
    pesoG: 620,
  },
  {
    slug: "blazer-fernanda",
    titulo: "Blazer Manga Curta Fernanda",
    categoria: "alfaiataria",
    preco: 369,
    cores: ["Azul-marinho"],
    tamanhos: PADRAO,
    imagens: ["vn-04.webp"],
    descricao:
      "Blazer de manga curta e botões contrastantes — a sobreposição certa para o calor do interior sem perder a estrutura.",
    composicao: "Linho misto. Meio forro. Lavar a seco.",
    tags: ["trabalho", "verao"],
    pesoG: 480,
  },
  {
    slug: "blazer-suede-manu",
    titulo: "Blazer Suede Manu",
    categoria: "alfaiataria",
    preco: 459,
    cores: ["Marrom"],
    tamanhos: PADRAO,
    imagens: ["vn-06.webp"],
    descricao:
      "Blazer em suede de toque macio, com botões forrados. Sobe o nível de um jeans com camiseta em dois segundos.",
    composicao: "Suede sintético. Forro completo. Limpeza a seco.",
    tags: ["inverno", "novidades"],
    pesoG: 700,
  },
  {
    slug: "trench-coat-antonia",
    titulo: "Trench Coat Antonia",
    categoria: "alfaiataria",
    preco: 589,
    cores: ["Caramelo"],
    tamanhos: PADRAO,
    imagens: ["vn-07.webp"],
    descricao:
      "Trench clássico de transpasse duplo, cinto e comprimento midi. Um investimento que atravessa temporadas sem sair de moda.",
    composicao: "Gabardine de algodão. Forro completo. Limpeza a seco.",
    tags: ["inverno"],
    destaque: true,
    pesoG: 950,
  },
  {
    slug: "moletom-cherry",
    titulo: "Moletom Cherry on Top",
    categoria: "alfaiataria",
    preco: 219,
    cores: ["Cinza"],
    tamanhos: PADRAO,
    imagens: ["vn-15.webp"],
    descricao:
      "Moletom de estampa exclusiva da coleção Cherry on Top, em algodão flanelado. Perfeito por baixo do trench.",
    composicao: "Moletom flanelado de algodão. Lavar do avesso.",
    tags: ["inverno", "dia-a-dia"],
    pesoG: 520,
  },

  // ─── Blusas & Camisas ──────────────────────────────────────────────────────
  {
    slug: "blusa-bordada-helena",
    titulo: "Blusa Bordada Helena",
    categoria: "blusas",
    preco: 249,
    cores: ["Oliva"],
    tamanhos: PADRAO,
    imagens: ["vn-01.webp"],
    descricao:
      "Tricô de manga curta com bordado geométrico em contraste e decote V discreto. Peça de destaque para usar com alfaiataria neutra.",
    composicao: "Fio de algodão com viscose. Bordado feito à mão. Lavar à mão.",
    tags: ["novidades", "trabalho"],
    destaque: true,
    pesoG: 320,
  },
  {
    slug: "camisa-linho-aurora",
    titulo: "Camisa Linho Aurora",
    categoria: "blusas",
    preco: 289,
    cores: ["Dourado"],
    tamanhos: PADRAO,
    imagens: ["vn-10.webp"],
    descricao:
      "Camisa ampla em linho com fio metalizado sutil e manga flare. Vai bem com jeans de dia e com saia longa à noite.",
    composicao: "Linho com fio metalizado. Lavar à mão, secar à sombra.",
    tags: ["novidades", "festa"],
    pesoG: 300,
  },
  {
    slug: "blusa-estela",
    titulo: "Blusa Ombro Único Estela",
    categoria: "blusas",
    preco: 259,
    cores: ["Vinho"],
    tamanhos: PADRAO,
    imagens: ["vn-11.webp"],
    descricao:
      "Ombro único, manga bufante e faixa marcando a cintura, em estampa floral discreta. Elegância com um toque de ousadia.",
    composicao: "Musseline de viscose. Forro no busto. Lavar à mão.",
    tags: ["festa"],
    pesoG: 260,
  },
  {
    slug: "camisa-tricoline-cecilia",
    titulo: "Camisa Tricoline Cecília",
    categoria: "blusas",
    preco: 229,
    cores: ["Azul-marinho", "Off-white"],
    tamanhos: PADRAO,
    imagens: ["vn-14.webp"],
    descricao:
      "Camisa de alfaiataria em tricoline com elastano, punho ajustável e caimento que não repuxa nos botões.",
    composicao: "Tricoline de algodão com elastano. Lavar à máquina.",
    tags: ["trabalho", "dia-a-dia"],
    destaque: true,
    pesoG: 280,
  },

  // ─── Tricô ─────────────────────────────────────────────────────────────────
  {
    slug: "colete-trico-dora",
    titulo: "Colete Tricô Dora",
    categoria: "trico",
    preco: 199,
    cores: ["Preto", "Off-white"],
    tamanhos: PADRAO,
    imagens: ["vn-09.webp"],
    descricao:
      "Colete de tricô canelado com ombro levemente estruturado. Peça de transição que resolve a meia-estação.",
    composicao: "Fio de viscose com algodão. Não pinica. Lavar à mão.",
    tags: ["novidades", "dia-a-dia"],
    pesoG: 300,
  },
  {
    slug: "cardiga-ivone",
    titulo: "Cardigã Canelado Ivone",
    categoria: "trico",
    preco: 259,
    cores: ["Preto"],
    tamanhos: PADRAO,
    imagens: ["vn-13.webp"],
    descricao:
      "Cardigã de decote V e botões forrados, em fio macio que não embola. O curinga do inverno do interior.",
    composicao: "Fio de viscose com algodão. Lavar à mão, secar na horizontal.",
    tags: ["inverno"],
    pesoG: 380,
  },

  // ─── Calças & Saias ────────────────────────────────────────────────────────
  {
    slug: "calca-wide-leg-julia",
    titulo: "Calça Wide Leg Julia",
    categoria: "calcas-saias",
    preco: 289,
    cores: ["Off-white"],
    tamanhos: PADRAO,
    imagens: ["vn-25.webp"],
    descricao:
      "Wide leg de cintura alta em linho, com bainha limpa e caimento que alonga a silhueta. Respira no calor.",
    composicao: "Linho com viscose. Forro até o joelho. Lavar à mão.",
    tags: ["verao", "trabalho"],
    destaque: true,
    pesoG: 420,
  },
  {
    slug: "conjunto-mariana",
    titulo: "Conjunto Saia Mariana",
    categoria: "calcas-saias",
    preco: 329,
    cores: ["Rosa-seco"],
    tamanhos: PADRAO,
    imagens: ["vn-31.webp"],
    descricao:
      "Top peplum e saia lápis em suede rosé. Conjunto curto que também funciona separado com camisa branca.",
    composicao: "Suede sintético. Saia forrada. Limpeza a seco.",
    tags: ["festa"],
    pesoG: 460,
  },
  {
    slug: "macacao-antonia",
    titulo: "Macacão Antonia",
    categoria: "conjuntos",
    preco: 399,
    cores: ["Off-white"],
    tamanhos: PADRAO,
    imagens: ["vn-32.webp"],
    descricao:
      "Macacão de manga curta com bolsos frontais, cinto de fivela e pernas amplas. Uma peça só e o look está pronto.",
    composicao: "Sarja de algodão. Lavar à máquina em ciclo suave.",
    tags: ["novidades", "dia-a-dia"],
    destaque: true,
    pesoG: 620,
  },
];
