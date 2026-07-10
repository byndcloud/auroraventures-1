import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronRight,
  Settings,
  ListPlus,
  Plus,
  Trash2,
  Save,
  Send,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";

interface CallField {
  id?: string;
  call_id?: string;
  field_type: string;
  label: string;
  placeholder: string;
  required: boolean;
  options: string[] | null;
  display_order: number;
}

const EMPTY_FORM = {
  title: "",
  description: "",
  vertical: "",
  call_type: "mercado",
  visibility: "publica",
  status: "ativa",
  deadline: "",
};

const EMPTY_FIELD = (): Partial<CallField> => ({
  field_type: "text",
  label: "",
  placeholder: "",
  required: false,
  options: null,
  display_order: 0,
});

export default function ChamadaForm() {
  const { id } = useParams<{ id?: string }>();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [fields, setFields] = useState<Partial<CallField>[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditing);

  useEffect(() => {
    if (!isEditing || !id) return;
    const fetchCall = async () => {
      setLoadingData(true);
      const { data: callData } = await supabase
        .from("calls")
        .select("*")
        .eq("id", id)
        .single();
      const { data: fieldsData } = await supabase
        .from("call_fields")
        .select("*")
        .eq("call_id", id)
        .order("display_order", { ascending: true });

      if (callData) {
        setForm({
          title: callData.title,
          description: callData.description,
          vertical: callData.vertical || "",
          call_type: callData.call_type,
          visibility: callData.visibility,
          status: callData.status,
          deadline: callData.deadline || "",
        });
      }
      if (fieldsData) {
        setFields(
          fieldsData.map((f: any) => ({
            field_type: f.field_type,
            label: f.label,
            placeholder: f.placeholder || "",
            required: f.required,
            options: f.options,
            display_order: f.display_order,
          }))
        );
      }
      setLoadingData(false);
    };
    fetchCall();
  }, [id, isEditing]);

  const addField = () => setFields((p) => [...p, EMPTY_FIELD()]);

  const updateField = (i: number, key: string, val: any) =>
    setFields((p) => p.map((f, idx) => (idx === i ? { ...f, [key]: val } : f)));

  const removeField = (i: number) =>
    setFields((p) => p.filter((_, idx) => idx !== i));

  const handleSave = async (statusOverride?: string) => {
    if (!form.title?.trim()) { toast.error("Informe o título da chamada."); return; }
    if (!form.description?.trim()) { toast.error("Informe a descrição."); return; }
    if (!form.call_type) { toast.error("Selecione o tipo da chamada."); return; }
    if (!form.visibility) { toast.error("Selecione a visibilidade."); return; }

    setIsSaving(true);

    const payload: any = {
      title: form.title.trim(),
      description: form.description.trim(),
      vertical: form.vertical?.trim() || null,
      call_type: form.call_type,
      visibility: form.visibility,
      status: statusOverride ?? form.status ?? "rascunho",
      deadline: form.deadline || null,
    };

    let callId = id;

    try {
      if (isEditing && id) {
        const { error } = await supabase
          .from("calls")
          .update(payload)
          .eq("id", id);
        if (error) throw error;

        await supabase.from("call_fields").delete().eq("call_id", id);
      } else {
        // auth uid (não profiles.id) — consistente com moved_by/created_by das demais tabelas
        payload.created_by = user?.id;
        const { data, error } = await supabase
          .from("calls")
          .insert(payload)
          .select()
          .single();
        if (error || !data) throw error || new Error("Erro ao criar chamada.");
        callId = data.id;
      }

      if (fields.length > 0) {
        const validFields = fields.filter((f) => f.label?.trim());
        if (validFields.length > 0) {
          const fieldsPayload = validFields.map((f, i) => ({
            call_id: callId!,
            field_type: f.field_type || "text",
            label: f.label!.trim(),
            placeholder: f.placeholder || null,
            required: f.required || false,
            options: f.options || null,
            display_order: i,
          }));
          const { error: fErr } = await supabase
            .from("call_fields")
            .insert(fieldsPayload);
          if (fErr) toast.error("Chamada salva, mas erro ao salvar os campos.");
        }
      }

      toast.success(isEditing ? "✅ Chamada atualizada!" : "✅ Chamada publicada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["calls"] });
      navigate("/admin");
    } catch (err: any) {
      toast.error("Erro ao salvar chamada.", { description: err?.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with breadcrumb */}
      <div className="border-b border-border/50 bg-card/40 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Admin
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Admin</span>
            <ChevronRight className="w-3 h-3" />
            <span>Chamadas</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">
              {isEditing ? "Editar Chamada" : "Nova Chamada"}
            </span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-10 flex-1 w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl font-bold gradient-text">
            {isEditing ? "Editar Chamada" : "Nova Chamada"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEditing
              ? "Atualize as configurações e o formulário desta chamada."
              : "Configure as informações e monte o formulário de participação."}
          </p>
        </motion.div>

        {/* SECTION 1: General Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="glass-card p-8 rounded-xl space-y-6"
        >
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Configurações Gerais
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium">
                Título da Chamada <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="ex: Chamada Aberta para HealthTechs 2026"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium">
                Descrição <span className="text-destructive">*</span>
              </label>
              <Textarea
                placeholder="Descreva o objetivo desta chamada, o perfil buscado e os benefícios para os participantes..."
                className="min-h-[120px]"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Vertical / Segmento</label>
              <Input
                placeholder="ex: HealthTech, GovTech, EdTech"
                value={form.vertical ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, vertical: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Prazo de Inscrições</label>
              <Input
                type="datetime-local"
                value={form.deadline ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Tipo <span className="text-destructive">*</span>
              </label>
              <Select
                value={form.call_type}
                onValueChange={(v) => setForm((p) => ({ ...p, call_type: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mercado">🚀 Mercado (Startups Externas)</SelectItem>
                  <SelectItem value="interno">🏢 Interno (Colaboradores)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Status Inicial <span className="text-destructive">*</span>
              </label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativa">✅ Ativa (visível imediatamente)</SelectItem>
                  <SelectItem value="rascunho">📝 Rascunho (salvar sem publicar)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium">
                Visibilidade <span className="text-destructive">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "publica", icon: "🌐", label: "Pública", sub: "Visível na Landing Page para qualquer visitante" },
                  { value: "privada", icon: "🔒", label: "Privada", sub: "Visível apenas para colaboradores autenticados" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, visibility: opt.value }))}
                    className={`glass-card p-4 rounded-xl text-left transition-all duration-200 ${
                      form.visibility === opt.value
                        ? "border-primary shadow-[0_0_20px_hsl(25_95%_55%/0.2)]"
                        : "hover:border-border"
                    }`}
                  >
                    <span className="text-2xl">{opt.icon}</span>
                    <p className="font-medium mt-2">{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* SECTION 2: Dynamic Fields Builder */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="glass-card p-8 rounded-xl space-y-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ListPlus className="w-5 h-5 text-primary" />
              Campos do Formulário
            </h2>
            <Button variant="outline" size="sm" onClick={addField}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Campo
            </Button>
          </div>

          {fields.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border/40 rounded-xl">
              <ListPlus className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhum campo adicionado.</p>
              <p className="text-xs mt-1">Clique em "Adicionar Campo" para montar o formulário.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div
                  key={index}
                  className="bg-card/60 border border-border/50 rounded-xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Campo {index + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-7 px-2"
                      onClick={() => removeField(index)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Tipo do Campo</label>
                      <Select
                        value={field.field_type ?? "text"}
                        onValueChange={(v) => updateField(index, "field_type", v)}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Texto curto</SelectItem>
                          <SelectItem value="textarea">Texto longo</SelectItem>
                          <SelectItem value="email">E-mail</SelectItem>
                          <SelectItem value="url">URL / Link</SelectItem>
                          <SelectItem value="number">Número</SelectItem>
                          <SelectItem value="select">Seleção única</SelectItem>
                          <SelectItem value="multiselect">Seleção múltipla</SelectItem>
                          <SelectItem value="date">Data</SelectItem>
                          <SelectItem value="checkbox">Checkbox</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Label (Pergunta)</label>
                      <Input
                        placeholder="ex: Qual o nome da sua startup?"
                        value={field.label ?? ""}
                        onChange={(e) => updateField(index, "label", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Placeholder (opcional)</label>
                      <Input
                        placeholder="Texto de exemplo dentro do campo..."
                        value={field.placeholder ?? ""}
                        onChange={(e) => updateField(index, "placeholder", e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <Checkbox
                        checked={field.required ?? false}
                        onCheckedChange={(v) => updateField(index, "required", Boolean(v))}
                        id={`required-${index}`}
                      />
                      <label htmlFor={`required-${index}`} className="text-sm cursor-pointer">
                        Campo obrigatório
                      </label>
                    </div>
                  </div>

                  {(field.field_type === "select" || field.field_type === "multiselect") && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        Opções (uma por linha)
                      </label>
                      <Textarea
                        placeholder={"Opção A\nOpção B\nOpção C"}
                        value={Array.isArray(field.options) ? field.options.join("\n") : ""}
                        onChange={(e) =>
                          updateField(index, "options", e.target.value.split("\n").filter(Boolean))
                        }
                        className="text-sm min-h-[90px] font-mono"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 bg-background/80 backdrop-blur-xl border-t border-border/50 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Button variant="ghost" onClick={() => navigate("/admin")}>
            Cancelar
          </Button>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => handleSave("rascunho")}
              disabled={isSaving}
            >
              <Save className="w-4 h-4 mr-2" />
              Salvar Rascunho
            </Button>
            <Button
              onClick={() => handleSave(form.status === "rascunho" ? "ativa" : form.status)}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {isEditing ? "Salvar Alterações" : "Publicar Chamada"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
