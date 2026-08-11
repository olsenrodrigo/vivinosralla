// Diretórios do provador, num módulo próprio para não haver ciclo de import
// entre as rotas, o serviço e a fila.

import path from "path";
import fs from "fs";

const uploadsDir = path.join(process.cwd(), "uploads");

export const provadorDir = path.join(uploadsDir, "provador");
export const origemDir = path.join(provadorDir, "origem");
export const resultadoDir = path.join(provadorDir, "resultado");

for (const d of [provadorDir, origemDir, resultadoDir]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}
