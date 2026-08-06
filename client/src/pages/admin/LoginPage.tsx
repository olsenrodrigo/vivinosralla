import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";

type PageState = "login" | "otp" | "setup";

export default function AdminLoginPage() {
  const [pageState, setPageState] = useState<PageState>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Setup fields
  const [setupName, setSetupName] = useState("");

  // OTP fields
  const [otpCode, setOtpCode] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [adminName, setAdminName] = useState("");
  const otpInputRef = useRef<HTMLInputElement>(null);

  const { login, verifyOtp } = useAdminAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (pageState === "otp") {
      setTimeout(() => otpInputRef.current?.focus(), 100);
    }
  }, [pageState]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(email, password);
      if (!result.success) {
        toast({ title: result.message || "Credenciais inválidas", variant: "destructive" });
        return;
      }
      if (result.requireOtp && result.otpToken) {
        setOtpToken(result.otpToken);
        setAdminName(result.adminName || "");
        setPageState("otp");
        return;
      }
      if (result.mustChangePassword) {
        navigate("/admin/trocar-senha");
        return;
      }
      navigate("/admin");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async (code: string) => {
    setLoading(true);
    try {
      const result = await verifyOtp(otpToken, code);
      if (!result.success) {
        toast({ title: result.message || "Código inválido ou expirado.", variant: "destructive" });
        setOtpCode("");
        otpInputRef.current?.focus();
        return;
      }
      if (result.mustChangePassword) {
        navigate("/admin/trocar-senha");
        return;
      }
      navigate("/admin");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = async (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 6);
    setOtpCode(cleaned);
    if (cleaned.length === 6) {
      await handleOtpVerify(cleaned);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) return;
    await handleOtpVerify(otpCode);
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const r = await fetch("/api/admin/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: setupName, email, password }),
    });
    setLoading(false);
    if (r.ok) {
      const data = await r.json();
      localStorage.setItem("admin_token", data.token);
      localStorage.setItem("admin_user", JSON.stringify(data.admin));
      navigate("/admin");
    } else {
      const d = await r.json();
      toast({ title: d.message || "Erro", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <img src="/brand/app-icon.svg" alt="" aria-hidden className="w-14 h-14 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-900">Painel Administrativo</h1>
          <p className="text-gray-500 text-sm mt-1">Vivi Nosralla</p>
        </div>

        {/* OTP State */}
        {pageState === "otp" ? (
          <div>
            <button
              onClick={() => { setPageState("login"); setOtpCode(""); }}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 mb-5 transition-colors"
            >
              <ArrowLeft size={14} /> Voltar
            </button>
            <div className="text-center mb-6">
              <p className="text-gray-700 font-medium">Olá, {adminName || "usuário"}!</p>
              <p className="text-gray-500 text-sm mt-1">
                Insira o código de 6 dígitos enviado para<br />
                <span className="font-medium text-gray-700">{email}</span>
              </p>
            </div>
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div>
                <input
                  ref={otpInputRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  value={otpCode}
                  onChange={e => handleOtpChange(e.target.value)}
                  placeholder="000000"
                  disabled={loading}
                  className="w-full text-center text-3xl font-bold tracking-[0.4em] border-2 rounded-xl px-4 py-4 outline-none transition-colors focus:border-gray-900 disabled:opacity-50"
                  style={{ letterSpacing: "0.4em" }}
                />
              </div>
              <Button
                type="submit"
                className="w-full py-3 bg-gray-900 text-white hover:bg-gray-800"
                disabled={loading || otpCode.length !== 6}
              >
                {loading ? "Verificando..." : "Verificar código"}
              </Button>
              <p className="text-center text-xs text-gray-400">
                O código é válido por 5 minutos.
              </p>
            </form>
          </div>
        ) : (
          <>
            {/* Login / Setup tab switch */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setPageState("login")}
                className={`flex-1 py-1.5 text-sm rounded-lg ${pageState === "login" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}
              >
                Entrar
              </button>
              <button
                onClick={() => setPageState("setup")}
                className={`flex-1 py-1.5 text-sm rounded-lg ${pageState === "setup" ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}
              >
                Primeiro acesso
              </button>
            </div>

            <form onSubmit={pageState === "setup" ? handleSetup : handleLogin} className="space-y-4">
              {pageState === "setup" && (
                <div>
                  <Label>Seu nome</Label>
                  <Input
                    value={setupName}
                    onChange={e => setSetupName(e.target.value)}
                    placeholder="Administrador"
                    className="mt-1"
                    required
                  />
                </div>
              )}
              <div>
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@email.com"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label>Senha</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1"
                  required
                  minLength={pageState === "setup" ? 8 : 1}
                />
              </div>
              <Button
                type="submit"
                className="w-full py-3 bg-gray-900 text-white hover:bg-gray-800"
                disabled={loading}
              >
                {loading ? "Aguarde..." : pageState === "setup" ? "Criar conta" : "Entrar"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
