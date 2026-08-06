import { useState } from "react";
import { useLocation } from "wouter";
import { Lock, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: "Muito fraca", color: "bg-red-500" };
  if (score === 2) return { score, label: "Fraca", color: "bg-orange-400" };
  if (score === 3) return { score, label: "Razoável", color: "bg-yellow-400" };
  if (score === 4) return { score, label: "Boa", color: "bg-blue-500" };
  return { score, label: "Forte", color: "bg-green-500" };
}

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { admin, changePassword } = useAdminAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const isMustChange = admin?.mustChangePassword ?? false;
  const strength = getPasswordStrength(newPassword);
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;
  const passwordsDiffer = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({ title: "A nova senha deve ter pelo menos 8 caracteres.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "As senhas não coincidem.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const ok = await changePassword(currentPassword, newPassword);
      if (!ok) {
        toast({ title: "Senha atual incorreta ou erro ao alterar.", variant: "destructive" });
        return;
      }
      toast({ title: "Senha alterada com sucesso!" });
      navigate("/admin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: "#2C3E50" }}>
            <Lock size={28} color="white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {isMustChange ? "Troca de senha obrigatória" : "Alterar senha"}
          </h1>
          {isMustChange ? (
            <p className="text-amber-600 text-sm mt-1 font-medium">
              Por segurança, você deve definir uma nova senha antes de continuar.
            </p>
          ) : (
            <p className="text-gray-500 text-sm mt-1">
              {admin?.name ? `Olá, ${admin.name}` : "Atualize sua senha de acesso"}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Senha atual</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1"
              required
              autoFocus
            />
          </div>

          <div>
            <Label>Nova senha</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="mt-1"
              required
              minLength={8}
            />
            {newPassword.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1 h-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div
                      key={i}
                      className={`flex-1 rounded-full transition-colors ${i <= strength.score ? strength.color : "bg-gray-200"}`}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500">Força: <span className="font-medium">{strength.label}</span></p>
              </div>
            )}
          </div>

          <div>
            <Label>Confirmar nova senha</Label>
            <div className="relative mt-1">
              <Input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className={confirmPassword.length > 0 ? (passwordsDiffer ? "border-red-400 pr-9" : "border-green-500 pr-9") : ""}
                required
              />
              {confirmPassword.length > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  {passwordsMatch
                    ? <CheckCircle size={16} className="text-green-500" />
                    : <XCircle size={16} className="text-red-400" />}
                </div>
              )}
            </div>
            {passwordsDiffer && (
              <p className="text-xs text-red-500 mt-1">As senhas não coincidem.</p>
            )}
          </div>

          {/* Hints */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-1">
            <p className="text-xs font-medium text-gray-600 mb-1">Dicas para uma senha forte:</p>
            {[
              { check: newPassword.length >= 8, text: "Pelo menos 8 caracteres" },
              { check: /[A-Z]/.test(newPassword), text: "Uma letra maiúscula" },
              { check: /[0-9]/.test(newPassword), text: "Um número" },
              { check: /[^A-Za-z0-9]/.test(newPassword), text: "Um caractere especial (!@#$...)" },
            ].map(({ check, text }) => (
              <div key={text} className="flex items-center gap-1.5">
                {check
                  ? <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
                  : <div className="w-3 h-3 rounded-full border border-gray-300 flex-shrink-0" />}
                <span className={`text-xs ${check ? "text-green-700" : "text-gray-400"}`}>{text}</span>
              </div>
            ))}
          </div>

          <Button
            type="submit"
            className="w-full py-3 bg-gray-900 text-white hover:bg-gray-800"
            disabled={loading || !passwordsMatch || newPassword.length < 8}
          >
            {loading ? "Salvando..." : "Alterar senha"}
          </Button>
        </form>
      </div>
    </div>
  );
}
