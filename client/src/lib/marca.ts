/**
 * Constantes da marca VIVI NOSRALLA.
 * Fonte: brandbook (insumos/), Instagram @vivianenosralla e linktr.ee/vivinosrallaloja.
 */

export const NOME = "VIVI NOSRALLA";
export const NOME_COMPLETO = "Viviane Nosralla";
export const DESDE = 2017;
export const CIDADE = "Monte Alto — SP";

export const WHATSAPP = "5516991737463";
export const WHATSAPP_LABEL = "(16) 99173-7463";
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP}`;
export const GRUPO_OUTLET_URL = "https://chat.whatsapp.com/CGCHk4fVqPA6Wtv7QRIHAK";

export const INSTAGRAM_HANDLE = "@vivianenosralla";
export const INSTAGRAM_URL = "https://www.instagram.com/vivianenosralla";

export const EMAIL = "contato@vivinosralla.com.br";

export const FRETE_GRATIS_ACIMA = 399;

/** Monta o link do WhatsApp já com a mensagem preenchida. */
export function whatsappCom(mensagem: string): string {
  return `${WHATSAPP_URL}?text=${encodeURIComponent(mensagem)}`;
}

/** Paleta de cores do catálogo — mesma tabela usada no seed (script/catalogo.ts). */
export const CORES_CATALOGO: Record<string, string> = {
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

/** Hex de uma cor do catálogo; cinza neutro se o nome for desconhecido. */
export function corHex(nome: string): string {
  return CORES_CATALOGO[nome] ?? "#c3c3c3";
}

/** Formata centavos/reais no padrão brasileiro. */
export function precoBR(valor: string | number): string {
  const n = typeof valor === "string" ? Number(valor) : valor;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
