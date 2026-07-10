import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AuroraLogo } from "@/components/AuroraLogo";
import {
  ArrowLeft,
  CalendarClock,
  Loader2,
  Send,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import type { Json } from "@/integrations/supabase/types";

interface CallData {
  id: string;
  title: string;
  description: string;
  status: string;
  call_type: string;
  visibility: string;
  vertical: string | null;
  deadline: string | null;
}

interface CallField {
  id: string;
  label: string;
  field_type: string;
  placeholder: string | null;
  required: boolean;
  options: Json | null;
  display_order: number;
}

export default function CallResponse() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [call, setCall] = useState<CallData | null>(null);
  const [fields, setFields] = useState<CallField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);

      // Fetch call
      const { data: callData, error: callErr } = await supabase
        .from("calls")
        .select("*")
        .eq("id", id)
        .single();

      if (callErr || !callData) {
        setError("Chamada não encontrada ou não disponível.");
        setLoading(false);
        return;
      }

      // Check if deadline has passed
      if (
        callData.deadline &&
        new Date(callData.deadline + "T23:59:59") < new Date()
      ) {
        setError("Esta chamada já foi encerrada.");
        setCall(callData as CallData);
        setLoading(false);
        return;
      }

      if (callData.status !== "ativa") {
        setError("Esta chamada não está mais aberta para submissões.");
        setCall(callData as CallData);
        setLoading(false);
        return;
      }

      setCall(callData as CallData);

      // Fetch fields
      const { data: fieldsData } = await supabase
        .from("call_fields")
        .select("*")
        .eq("call_id", id)
        .order("display_order", { ascending: true });

      setFields((fieldsData as CallField[]) ?? []);

      // Check if user already submitted
      if (user) {
        const { data: existing } = await supabase
          .from("call_responses")
          .select("id")
          .eq("call_id", id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (existing) setAlreadySubmitted(true);
      }

      setLoading(false);
    };
    load();
  }, [id, user]);

  const updateField = (fieldId: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async () => {
    if (!user || !id) {
      toast.error("Você precisa estar logado para participar.");
      return;
    }

    // Validate required fields
    for (const field of fields) {
      if (field.required) {
        const val = formData[field.id];
        if (val === undefined || val === null || val === "") {
          toast.error(`O campo "${field.label}" é obrigatório.`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const { error: insertErr } = await supabase
        .from("call_responses")
        .insert({
          call_id: id,
          user_id: user.id,
          respondent_email: user.email,
          response_data: formData as Json,
        });

      if (insertErr) throw insertErr;

      toast.success("Resposta enviada com sucesso! 🎉");
      setAlreadySubmitted(true);
    } catch (err: any) {
      toast.error("Erro ao enviar resposta.", { description: err?.message });
    } finally {
      setSubmitting(false);
    }
  };

  const backPath =
    profile?.role === "colaborador"
      ? "/dashboard-colaborador"
      : "/";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-16 border-b border-border flex items-center px-6 justify-between bg-card/30 backdrop-blur-xl">
        <AuroraLogo className="text-lg" />
        <Button variant="ghost" size="sm" onClick={() => navigate(backPath)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao Dashboard
        </Button>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {/* Error state */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-xl p-10 text-center space-y-4"
          >
            <AlertTriangle className="w-10 h-10 mx-auto text-destructive/70" />
            <h2 className="text-xl font-bold">{error}</h2>
            {call && (
              <p className="text-sm text-muted-foreground">{call.title}</p>
            )}
            <Button variant="outline" onClick={() => navigate(backPath)}>
              Voltar ao Dashboard
            </Button>
          </motion.div>
        )}

        {/* Already submitted state */}
        {!error && alreadySubmitted && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-xl p-10 text-center space-y-4"
          >
            <CheckCircle2 className="w-10 h-10 mx-auto text-accent" />
            <h2 className="text-xl font-bold">Resposta enviada!</h2>
            <p className="text-sm text-muted-foreground">
              Você já submeteu sua participação para esta chamada. Os resultados
              serão divulgados em breve.
            </p>
            <Button variant="outline" onClick={() => navigate(backPath)}>
              Voltar ao Dashboard
            </Button>
          </motion.div>
        )}

        {/* Form */}
        {!error && !alreadySubmitted && call && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Call header */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-accent/20 text-accent border-accent/30">
                  ● Aberta
                </Badge>
                {call.vertical && (
                  <Badge variant="outline">{call.vertical}</Badge>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">{call.title}</h1>
              {call.deadline && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <CalendarClock className="w-4 h-4" />
                  Inscrições até{" "}
                  {new Date(call.deadline).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {call.description}
              </p>
            </div>

            <Separator />

            {/* Dynamic form fields */}
            {fields.length === 0 ? (
              <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
                <p className="text-sm">
                  Esta chamada não possui campos de formulário configurados.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <h2 className="text-lg font-semibold">
                  Formulário de Participação
                </h2>
                {fields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <label className="text-sm font-medium">
                      {field.label}
                      {field.required && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </label>
                    {renderField(field, formData[field.id], (val) =>
                      updateField(field.id, val)
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Submit */}
            <div className="pt-4">
              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmit}
                disabled={submitting || fields.length === 0}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Enviar Participação
              </Button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

function renderField(
  field: CallField,
  value: any,
  onChange: (val: any) => void
) {
  const options = Array.isArray(field.options) ? (field.options as string[]) : [];

  switch (field.field_type) {
    case "textarea":
      return (
        <Textarea
          placeholder={field.placeholder || ""}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[100px]"
        />
      );
    case "email":
      return (
        <Input
          type="email"
          placeholder={field.placeholder || "email@exemplo.com"}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "url":
      return (
        <Input
          type="url"
          placeholder={field.placeholder || "https://..."}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          placeholder={field.placeholder || ""}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "date":
      return (
        <Input
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={value ?? false}
            onCheckedChange={(v) => onChange(Boolean(v))}
          />
          <span className="text-sm text-muted-foreground">
            {field.placeholder || "Sim"}
          </span>
        </div>
      );
    case "select":
      return (
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder={field.placeholder || "Selecione..."} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "multiselect":
      return (
        <div className="space-y-2">
          {options.map((opt) => {
            const selected: string[] = Array.isArray(value) ? value : [];
            return (
              <div key={opt} className="flex items-center gap-2">
                <Checkbox
                  checked={selected.includes(opt)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onChange([...selected, opt]);
                    } else {
                      onChange(selected.filter((s) => s !== opt));
                    }
                  }}
                />
                <span className="text-sm">{opt}</span>
              </div>
            );
          })}
        </div>
      );
    default:
      return (
        <Input
          placeholder={field.placeholder || ""}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
