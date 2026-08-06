import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

// Segredo previsível deixaria qualquer um forjar token de admin. Em produção
// falta de JWT_SECRET é erro fatal; em dev cai num valor aleatório por processo
// (as sessões existentes caem a cada restart, que é o comportamento correto).
const JWT_SECRET = (() => {
  const doAmbiente = process.env.JWT_SECRET;
  if (doAmbiente) return doAmbiente;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET é obrigatório em produção.");
  }
  console.warn("[auth] JWT_SECRET ausente — usando segredo aleatório de desenvolvimento.");
  return randomBytes(32).toString("hex");
})();

// ─── In-memory OTP store ───────────────────────────────────────────────────
interface OtpEntry { code: string; email: string; expiresAt: number; used: boolean; }
const otpStore = new Map<string, OtpEntry>();

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function storeOtp(email: string): string {
  const code = generateOtp();
  const key = `${email}:${code}`;
  otpStore.set(key, { code, email, expiresAt: Date.now() + 5 * 60 * 1000, used: false });
  // Clean up old entries
  for (const [k, v] of otpStore) {
    if (v.expiresAt < Date.now()) otpStore.delete(k);
  }
  return code;
}

export function verifyOtp(email: string, code: string): boolean {
  const key = `${email}:${code}`;
  const entry = otpStore.get(key);
  if (!entry) return false;
  if (entry.used) return false;
  if (entry.expiresAt < Date.now()) return false;
  if (entry.email !== email) return false;
  entry.used = true;
  return true;
}

// ─── In-memory rate limiter ────────────────────────────────────────────────
interface AttemptEntry { count: number; blockedUntil: number; }
const attemptStore = new Map<string, AttemptEntry>();
const MAX_ATTEMPTS = 5;
const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes

export function checkRateLimit(identifier: string): { blocked: boolean; minutesLeft?: number } {
  const entry = attemptStore.get(identifier);
  if (!entry) return { blocked: false };
  if (entry.blockedUntil > Date.now()) {
    const minutesLeft = Math.ceil((entry.blockedUntil - Date.now()) / 60000);
    return { blocked: true, minutesLeft };
  }
  return { blocked: false };
}

export function recordFailedAttempt(identifier: string): void {
  const entry = attemptStore.get(identifier) || { count: 0, blockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = Date.now() + BLOCK_DURATION;
  }
  attemptStore.set(identifier, entry);
}

export function resetAttempts(identifier: string): void {
  attemptStore.delete(identifier);
}

// ─── Sign a short-lived pre-MFA token ─────────────────────────────────────
export function signOtpToken(email: string): string {
  return jwt.sign({ email, type: "otp" }, JWT_SECRET, { expiresIn: "5m" });
}

export function verifyOtpToken(token: string): { email: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "otp") return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function comparePassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function signToken(payload: { id: number; email: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Token não fornecido" });
    return;
  }
  const token = auth.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ message: "Token inválido ou expirado" });
    return;
  }
  (req as any).admin = payload;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      res.status(401).json({ message: "Token não fornecido" });
      return;
    }
    const token = auth.slice(7);
    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({ message: "Token inválido ou expirado" });
      return;
    }
    if (!roles.includes(payload.role)) {
      res.status(403).json({ message: "Acesso não autorizado" });
      return;
    }
    (req as any).admin = payload;
    next();
  };
}
