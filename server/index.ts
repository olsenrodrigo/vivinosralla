// PRIMEIRO import, sempre: povoa process.env antes de qualquer módulo da
// aplicação ser avaliado (server/auth.ts lê JWT_SECRET em topo de módulo).
import "./env";

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

/**
 * Troca UUIDs do caminho por um marcador antes de logar.
 *
 * No provador, o token da prova É a credencial que serve a imagem: quem lê o
 * log consegue baixar foto de corpo de terceiro, e a proteção de URL não
 * adivinhável some. O mesmo vale para o identificador de sessão de carrinho.
 * O caminho continua legível para diagnóstico — só o identificador sai.
 */
function redigirIdentificadores(path: string): string {
  return path.replace(UUID, ":id");
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${redigirIdentificadores(path)} ${res.statusCode} in ${duration}ms`;
      // LGPD: o corpo da resposta só é logado em rotas de catálogo, que não
      // carregam dado pessoal. Antes a lista era de exceções, e qualquer rota
      // nova (pedidos, clientes, carrinhos abandonados) passava a despejar
      // CPF, telefone e endereço no log.
      const catalogoPublico =
        path.startsWith("/api/store/") &&
        !path.includes("/reviews") &&
        !path.startsWith("/api/store/settings");
      if (capturedJsonResponse && catalogoPublico) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  // Expurgo LGPD do contato de carrinhos abandonados (retenção 30 dias): boot + diário.
  const { storage: _storage } = await import("./storage");
  const purgeCarts = () =>
    _storage.purgeExpiredCartContacts(30).catch((e: any) =>
      console.error("[carts] ALERTA: expurgo LGPD de carrinhos falhou:", e?.message)
    );
  purgeCarts();
  setInterval(purgeCarts, 24 * 60 * 60 * 1000).unref();

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
