import { useState, useRef } from "react";
import { Upload, Download, CheckCircle, XCircle, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function AdminImport() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = (f: File) => {
    const valid = [".csv", ".xlsx", ".xls"].some(ext => f.name.toLowerCase().endsWith(ext));
    if (!valid) { toast({ title: "Arquivo inválido. Use CSV ou XLSX", variant: "destructive" }); return; }
    setFile(f);
    setResult(null);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const r = await fetch("/api/admin/products/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
        body: formData,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setResult(d);
      toast({ title: `Importação concluída! ${d.created} criado(s), ${d.updated} atualizado(s)` });
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const downloadTemplate = () => {
    window.open("/api/admin/products/import/template", "_blank");
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Importar Produtos</h1>
        <p className="text-gray-500 text-sm mt-0.5">Importe ou atualize produtos em massa via planilha</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Instructions */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><FileSpreadsheet size={18} /> Formato da Planilha</h3>
          <Button variant="outline" onClick={downloadTemplate} className="mb-5 gap-2 w-full">
            <Download size={16} /> Baixar modelo (.xlsx)
          </Button>
          <div className="space-y-3 text-sm">
            <p className="text-gray-600">Colunas obrigatórias:</p>
            <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs space-y-1">
              <p><span className="text-red-500 font-bold">Handle</span> — slug único (ex: camiseta-azul)</p>
              <p><span className="text-red-500 font-bold">Title</span> — nome do produto</p>
              <p><span className="text-red-500 font-bold">Price</span> — preço (ex: 79.90)</p>
            </div>
            <p className="text-gray-600 mt-3">Colunas opcionais:</p>
            <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs space-y-1 columns-2">
              {["Description (HTML)", "Vendor", "Brand", "Type", "Tags", "Status", "Published",
                "SKU", "Barcode", "Compare At Price", "Cost Per Item", "Weight (g)",
                "Inventory Quantity", "Option1 Name", "Option1 Value", "Option2 Value",
                "Image 1 URL", "Image 1 Alt", "SEO Title", "SEO Description"].map(col => (
                <p key={col} className="text-gray-500">{col}</p>
              ))}
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-blue-700 text-xs flex gap-2">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Produtos com variantes:</p>
                <p>Use uma linha por variante com o mesmo Handle. A primeira linha carrega título/descrição, as seguintes só os valores da variante.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Upload */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Upload size={18} /> Enviar arquivo</h3>

          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-4 ${file ? "border-green-300 bg-green-50" : "border-gray-200 hover:border-gray-400 bg-gray-50"}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          >
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {file ? (
              <div>
                <CheckCircle size={32} className="mx-auto text-green-500 mb-2" />
                <p className="font-medium text-green-700">{file.name}</p>
                <p className="text-sm text-green-600">{(file.size / 1024).toFixed(0)} KB</p>
                <button onClick={e => { e.stopPropagation(); setFile(null); }} className="mt-2 text-xs text-gray-400 hover:text-gray-600">
                  Trocar arquivo
                </button>
              </div>
            ) : (
              <div>
                <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                <p className="text-gray-600 font-medium">Arraste o arquivo ou clique aqui</p>
                <p className="text-sm text-gray-400 mt-1">CSV, XLSX ou XLS — máx. 50MB</p>
              </div>
            )}
          </div>

          <Button
            onClick={handleImport}
            disabled={!file || loading}
            className="w-full bg-gray-900 text-white hover:bg-gray-800 py-3"
          >
            {loading ? "Processando..." : "Importar produtos"}
          </Button>

          {/* Results */}
          {result && (
            <div className="mt-5 p-4 bg-gray-50 rounded-xl">
              <h4 className="font-semibold text-gray-800 mb-3">Resultado da importação</h4>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{result.created}</p>
                  <p className="text-xs text-green-600">Criado(s)</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
                  <p className="text-xs text-blue-600">Atualizado(s)</p>
                </div>
              </div>
              {result.errors?.length > 0 && (
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                    <XCircle size={14} /> {result.errors.length} erro(s):
                  </p>
                  <ul className="space-y-1">
                    {result.errors.map((err: string, i: number) => (
                      <li key={i} className="text-xs text-red-600">{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
