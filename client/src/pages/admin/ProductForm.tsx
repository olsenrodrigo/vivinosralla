import { useState, useEffect, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { ArrowLeft, Upload, X, Plus, Star, Trash2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminFetch } from "@/context/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";

export default function AdminProductForm() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const [form, setForm] = useState({
    title: "", slug: "", description: "", vendor: "", brand: "", type: "",
    tags: "", sku: "", barcode: "", price: "", compareAtPrice: "", costPerItem: "",
    weightG: "", stockQuantity: "0", status: "active", published: true,
    freeShipping: false, trackInventory: true, categoryId: "",
    seoTitle: "", seoDescription: "",
  });

  useEffect(() => {
    adminFetch("/api/admin/categories").then(r => r.json()).then(setCategories).catch(() => {});
    if (isEdit) {
      setLoading(true);
      adminFetch(`/api/admin/products/${id}`).then(r => r.json()).then(data => {
        setForm({
          title: data.title || "", slug: data.slug || "", description: data.description || "",
          vendor: data.vendor || "", brand: data.brand || "", type: data.type || "",
          tags: data.tags || "", sku: data.sku || "", barcode: data.barcode || "",
          price: data.price || "", compareAtPrice: data.compareAtPrice || "",
          costPerItem: data.costPerItem || "", weightG: String(data.weightG || ""),
          stockQuantity: String(data.stockQuantity || 0), status: data.status || "active",
          published: data.published !== false, freeShipping: data.freeShipping || false,
          trackInventory: data.trackInventory !== false,
          categoryId: data.categoryId ? String(data.categoryId) : "",
          seoTitle: data.seoTitle || "", seoDescription: data.seoDescription || "",
        });
        setImages(data.images || []);
        setVariants(data.variants || []);
      }).finally(() => setLoading(false));
    }
  }, [id]);

  const slugify = (text: string) => text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");

  const handleTitleChange = (title: string) => {
    setForm(f => ({ ...f, title, ...(!isEdit || !f.slug ? { slug: slugify(title) } : {}) }));
  };

  const handleSave = async () => {
    if (!form.title || !form.price) {
      toast({ title: "Nome e preço são obrigatórios", variant: "destructive" }); return;
    }
    setSaving(true);
    const body = {
      ...form,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      stockQuantity: Number(form.stockQuantity),
      weightG: form.weightG ? Number(form.weightG) : null,
    };
    try {
      const r = isEdit
        ? await adminFetch(`/api/admin/products/${id}`, { method: "PUT", body: JSON.stringify(body) })
        : await adminFetch("/api/admin/products", { method: "POST", body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).message);
      const data = await r.json();
      toast({ title: isEdit ? "Produto atualizado!" : "Produto criado!" });
      if (!isEdit) navigate(`/admin/produtos/${data.id}`);
    } catch (e: any) {
      toast({ title: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleImageUpload = async (files: FileList) => {
    if (!id) { toast({ title: "Salve o produto antes de adicionar imagens", variant: "destructive" }); return; }
    setUploadingImages(true);
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append("images", f));
    try {
      const r = await fetch(`/api/admin/products/${id}/images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("admin_token")}` },
        body: formData,
      });
      const saved = await r.json();
      setImages(imgs => [...imgs, ...saved]);
      toast({ title: `${saved.length} imagem(ns) adicionada(s)!` });
    } catch (e: any) {
      toast({ title: "Erro ao enviar imagem", variant: "destructive" });
    } finally { setUploadingImages(false); }
  };

  const handleDeleteImage = async (imgId: number) => {
    await adminFetch(`/api/admin/products/images/${imgId}`, { method: "DELETE" });
    setImages(imgs => imgs.filter(i => i.id !== imgId));
  };

  const handleSetMain = async (imgId: number) => {
    await adminFetch(`/api/admin/products/${id}/images/${imgId}/main`, { method: "PUT" });
    setImages(imgs => imgs.map(i => ({ ...i, isMain: i.id === imgId })));
  };

  const addVariant = () => setVariants(v => [...v, { id: Date.now(), sku: "", price: form.price, option1: "", option2: "", stockQuantity: 0, active: true, isNew: true }]);
  const updateVariant = async (variant: any) => {
    if (!variant.isNew && id) {
      await adminFetch(`/api/admin/variants/${variant.id}`, { method: "PUT", body: JSON.stringify(variant) });
      toast({ title: "Variante atualizada" });
    }
  };
  const deleteVariant = async (variantId: number, isNew: boolean) => {
    if (!isNew) await adminFetch(`/api/admin/variants/${variantId}`, { method: "DELETE" });
    setVariants(v => v.filter(x => x.id !== variantId));
  };
  const saveNewVariant = async (variant: any, index: number) => {
    if (!id) return;
    const r = await adminFetch(`/api/admin/products/${id}/variants`, { method: "POST", body: JSON.stringify(variant) });
    const saved = await r.json();
    setVariants(v => v.map((x, i) => i === index ? { ...saved } : x));
    toast({ title: "Variante salva!" });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-gray-900" /></div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/produtos"><a className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg no-underline"><ArrowLeft size={18} /></a></Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{isEdit ? "Editar produto" : "Novo produto"}</h1>
          {isEdit && <p className="text-xs text-gray-400">ID: {id}</p>}
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => navigate("/admin/produtos")}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-gray-900 text-white hover:bg-gray-800">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="xl:col-span-2 space-y-5">
          {/* Basic info */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Informações básicas</h3>
            <div className="space-y-4">
              <div>
                <Label>Nome do produto *</Label>
                <Input value={form.title} onChange={e => handleTitleChange(e.target.value)} placeholder="Ex: Camiseta Azul Manga Longa" className="mt-1" />
              </div>
              <div>
                <Label>Slug (URL)</Label>
                <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="camiseta-azul" className="mt-1" />
                <p className="text-xs text-gray-400 mt-1">/loja/produto/{form.slug || "..."}</p>
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Descrição completa do produto... HTML permitido"
                  className="mt-1 min-h-28" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Marca / Brand</Label>
                  <Input value={form.brand} onChange={e => setForm(f => ({...f, brand: e.target.value}))} placeholder="Nike" className="mt-1" />
                </div>
                <div>
                  <Label>Fornecedor</Label>
                  <Input value={form.vendor} onChange={e => setForm(f => ({...f, vendor: e.target.value}))} placeholder="Fornecedor XYZ" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo</Label>
                  <Input value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))} placeholder="Camiseta" className="mt-1" />
                </div>
                <div>
                  <Label>Tags</Label>
                  <Input value={form.tags} onChange={e => setForm(f => ({...f, tags: e.target.value}))} placeholder="verão, casual, promoção" className="mt-1" />
                </div>
              </div>
            </div>
          </div>

          {/* Images */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Imagens ({images.length}/10)</h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-4">
              {images.sort((a, b) => a.position - b.position).map(img => (
                <div key={img.id} className="relative group aspect-square">
                  <img src={img.url} alt="" className="w-full h-full object-cover rounded-lg border" />
                  {img.isMain && (
                    <div className="absolute top-1 left-1 bg-yellow-400 rounded text-xs p-0.5" title="Imagem principal">
                      <Star size={10} fill="white" color="white" />
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    <button onClick={() => handleSetMain(img.id)} title="Definir como principal" className="p-1 bg-yellow-400 rounded text-white text-xs"><Star size={12} /></button>
                    <button onClick={() => handleDeleteImage(img.id)} className="p-1 bg-red-500 rounded text-white"><X size={12} /></button>
                  </div>
                </div>
              ))}
              {images.length < 10 && (
                <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-gray-400 transition-colors">
                  <ImagePlus size={20} className="text-gray-400 mb-1" />
                  <span className="text-xs text-gray-400">Adicionar</span>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={e => e.target.files && handleImageUpload(e.target.files)} />
                </label>
              )}
            </div>
            {uploadingImages && <p className="text-sm text-gray-500">Enviando imagens...</p>}
            {!isEdit && <p className="text-xs text-gray-400">Salve o produto primeiro para adicionar imagens</p>}
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); e.dataTransfer.files && handleImageUpload(e.dataTransfer.files); }}>
              <Upload size={24} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-500">Arraste imagens ou clique para selecionar</p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP — máx. 10MB cada</p>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Preços e estoque</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <Label>Preço de venda *</Label>
                <div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                <Input value={form.price} onChange={e => setForm(f => ({...f, price: e.target.value}))} className="pl-9" placeholder="0,00" /></div>
              </div>
              <div>
                <Label>Preço de (riscado)</Label>
                <div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                <Input value={form.compareAtPrice} onChange={e => setForm(f => ({...f, compareAtPrice: e.target.value}))} className="pl-9" placeholder="0,00" /></div>
              </div>
              <div>
                <Label>Custo</Label>
                <div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                <Input value={form.costPerItem} onChange={e => setForm(f => ({...f, costPerItem: e.target.value}))} className="pl-9" placeholder="0,00" /></div>
              </div>
              <div>
                <Label>Estoque</Label>
                <Input type="number" value={form.stockQuantity} onChange={e => setForm(f => ({...f, stockQuantity: e.target.value}))} className="mt-1" min="0" />
              </div>
              <div>
                <Label>SKU</Label>
                <Input value={form.sku} onChange={e => setForm(f => ({...f, sku: e.target.value}))} placeholder="CAM-AZL-M" className="mt-1" />
              </div>
              <div>
                <Label>Código de barras</Label>
                <Input value={form.barcode} onChange={e => setForm(f => ({...f, barcode: e.target.value}))} placeholder="EAN-13" className="mt-1" />
              </div>
            </div>
            <div className="mt-4">
              <Label>Peso (gramas)</Label>
              <Input type="number" value={form.weightG} onChange={e => setForm(f => ({...f, weightG: e.target.value}))} placeholder="300" className="mt-1 max-w-32" />
            </div>
          </div>

          {/* Variants */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Variantes ({variants.length})</h3>
              <Button variant="outline" size="sm" onClick={addVariant} className="gap-1"><Plus size={14} /> Adicionar</Button>
            </div>
            {variants.length === 0 ? (
              <p className="text-sm text-gray-400">Sem variantes — produto simples sem opções de cor/tamanho</p>
            ) : (
              <div className="space-y-3">
                {variants.map((v, i) => (
                  <div key={v.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg flex-wrap">
                    <Input value={v.option1 || ""} onChange={e => setVariants(vs => vs.map((x, j) => j === i ? {...x, option1: e.target.value} : x))} placeholder="Cor / Tamanho" className="w-28" />
                    <Input value={v.option2 || ""} onChange={e => setVariants(vs => vs.map((x, j) => j === i ? {...x, option2: e.target.value} : x))} placeholder="Opção 2" className="w-24" />
                    <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">R$</span>
                    <Input value={v.price} onChange={e => setVariants(vs => vs.map((x, j) => j === i ? {...x, price: e.target.value} : x))} className="w-24 pl-7" placeholder="0,00" /></div>
                    <Input type="number" value={v.stockQuantity} onChange={e => setVariants(vs => vs.map((x, j) => j === i ? {...x, stockQuantity: Number(e.target.value)} : x))} className="w-20" placeholder="Qtd" min="0" />
                    <Input value={v.sku || ""} onChange={e => setVariants(vs => vs.map((x, j) => j === i ? {...x, sku: e.target.value} : x))} placeholder="SKU" className="w-28" />
                    {v.isNew ? (
                      <Button size="sm" onClick={() => saveNewVariant(v, i)} className="text-xs">Salvar</Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => updateVariant(v)} className="text-xs">Atualizar</Button>
                    )}
                    <button onClick={() => deleteVariant(v.id, !!v.isNew)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Status */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Publicação</h3>
            <div className="space-y-3">
              <div>
                <Label>Status</Label>
                <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}
                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
                  <option value="active">Ativo</option>
                  <option value="draft">Rascunho</option>
                  <option value="archived">Arquivado</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="published" checked={form.published} onChange={e => setForm(f => ({...f, published: e.target.checked}))} className="w-4 h-4" />
                <Label htmlFor="published" className="cursor-pointer">Visível na loja</Label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="freeShipping" checked={form.freeShipping} onChange={e => setForm(f => ({...f, freeShipping: e.target.checked}))} className="w-4 h-4" />
                <Label htmlFor="freeShipping" className="cursor-pointer">Frete grátis</Label>
              </div>
            </div>
          </div>

          {/* Category */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-3">Categoria</h3>
            <select value={form.categoryId} onChange={e => setForm(f => ({...f, categoryId: e.target.value}))}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
              <option value="">Sem categoria</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* SEO */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-4">SEO</h3>
            <div className="space-y-3">
              <div>
                <Label>Meta título</Label>
                <Input value={form.seoTitle} onChange={e => setForm(f => ({...f, seoTitle: e.target.value}))} placeholder={form.title} className="mt-1" maxLength={70} />
                <p className="text-xs text-gray-400 mt-0.5">{form.seoTitle.length}/70</p>
              </div>
              <div>
                <Label>Meta descrição</Label>
                <Textarea value={form.seoDescription} onChange={e => setForm(f => ({...f, seoDescription: e.target.value}))} placeholder="Descrição para buscadores..." className="mt-1" maxLength={320} rows={3} />
                <p className="text-xs text-gray-400 mt-0.5">{form.seoDescription.length}/320</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
