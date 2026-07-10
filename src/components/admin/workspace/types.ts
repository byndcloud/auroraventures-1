export type WorkspaceTask = {
  id: string;
  external_id: string;
  tipo: "ajuste" | "melhoria" | "nova";
  perfil: string;
  screen: string | null;
  route: string | null;
  area: string | null;
  title: string;
  description: string | null;
  comentario: string | null;
  status: "pendente" | "em_andamento" | "aceita" | "rejeitada" | "concluida";
  priority: "P0" | "P1" | "P2" | "P3";
  quick_win: boolean;
  tem_decisao_aberta: boolean;
  depends_on: string[];
  merged_from: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export const PRIORITIES: WorkspaceTask["priority"][] = ["P0", "P1", "P2", "P3"];
export const TIPOS: WorkspaceTask["tipo"][] = ["ajuste", "melhoria", "nova"];
export const STATUSES: WorkspaceTask["status"][] = [
  "pendente",
  "em_andamento",
  "aceita",
  "rejeitada",
  "concluida",
];
export const PERFIS = ["admin", "colab", "founder", "viewer", "transversal"];

export const PRIORITY_LABEL: Record<WorkspaceTask["priority"], string> = {
  P0: "P0 · Crítica",
  P1: "P1 · Alta",
  P2: "P2 · Média",
  P3: "P3 · Baixa",
};

export const TIPO_LABEL: Record<WorkspaceTask["tipo"], string> = {
  ajuste: "Ajuste",
  melhoria: "Melhoria",
  nova: "Nova",
};

export const STATUS_LABEL: Record<WorkspaceTask["status"], string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  aceita: "Aceita",
  rejeitada: "Rejeitada",
  concluida: "Concluída",
};
