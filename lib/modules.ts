export const MODULES = [
  { id: "dashboard", label: "Dashboard" },
  { id: "map", label: "Carte des contribuables" },
  { id: "taxpayers", label: "Contribuables" },
  { id: "collections", label: "Recouvrements d'impots" },
  { id: "collectors", label: "Collecteurs & API" },
  { id: "payments", label: "Paiements" },
  { id: "reductions", label: "Reductions" },
  { id: "reports", label: "Rapports" },
  { id: "audit", label: "Audit" },
  { id: "logs", label: "Journal d'activites" },
  { id: "user-management", label: "Gestion des utilisateurs" },
  { id: "global-calculation", label: "Calcul global des taxes" },
  { id: "settings", label: "Parametrage" },
] as const;

export type ModuleId = (typeof MODULES)[number]["id"];

export const MODULE_IDS: readonly ModuleId[] = MODULES.map((module) => module.id);
