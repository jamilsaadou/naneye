"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

type ApiLog = {
  id: string;
  createdAt: Date;
  collectorName: string | null;
  status: string;
  message: string | null;
  requestPayload: unknown;
  responsePayload: unknown;
};

function getHttpCode(status: string): number {
  return status === "SUCCESS" || status === "IGNORED" ? 200 : 400;
}

function getStatusBadge(status: string) {
  const colors: Record<string, string> = {
    SUCCESS: "bg-emerald-100 text-emerald-700",
    FAILED: "bg-red-100 text-red-700",
    IGNORED: "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-slate-100 text-slate-700"}`}>
      {status}
    </span>
  );
}

function getHttpCodeBadge(code: number) {
  const isSuccess = code >= 200 && code < 300;
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${isSuccess ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
      {code}
    </span>
  );
}

function getCustomCode(responsePayload: unknown): string {
  if (typeof responsePayload === "object" && responsePayload !== null && "ok" in responsePayload) {
    return (responsePayload as { ok: boolean }).ok ? "OK" : "ERROR";
  }
  return "-";
}

function getCustomCodeBadge(code: string) {
  const colors: Record<string, string> = {
    OK: "bg-emerald-100 text-emerald-700",
    ERROR: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${colors[code] ?? "bg-slate-100 text-slate-700"}`}>
      {code}
    </span>
  );
}

export function ApiLogsTable({ logs }: { logs: ApiLog[] }) {
  const [selectedLog, setSelectedLog] = useState<ApiLog | null>(null);
  const [viewType, setViewType] = useState<"request" | "response">("response");

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Collecteur</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>HTTP</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Donnees</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="whitespace-nowrap text-xs">
                {new Date(log.createdAt).toLocaleString("fr-FR")}
              </TableCell>
              <TableCell>{log.collectorName ?? "-"}</TableCell>
              <TableCell>{getStatusBadge(log.status)}</TableCell>
              <TableCell className="max-w-[200px] truncate text-xs" title={log.message ?? ""}>
                {log.message ?? "-"}
              </TableCell>
              <TableCell>{getHttpCodeBadge(getHttpCode(log.status))}</TableCell>
              <TableCell>{getCustomCodeBadge(getCustomCode(log.responsePayload))}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLog(log);
                      setViewType("request");
                    }}
                    className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-200"
                  >
                    req
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLog(log);
                      setViewType("response");
                    }}
                    className="rounded bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 hover:bg-violet-200"
                  >
                    res
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {logs.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                Aucun appel enregistre.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedLog(null)}>
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">
                  {viewType === "request" ? "Requete" : "Reponse"} API
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setViewType("request")}
                    className={`rounded px-2 py-1 text-xs font-medium ${viewType === "request" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
                  >
                    Requete
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewType("response")}
                    className={`rounded px-2 py-1 text-xs font-medium ${viewType === "response" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-700"}`}
                  >
                    Reponse
                  </button>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                Fermer
              </Button>
            </div>
            <div className="max-h-[60vh] overflow-auto p-4">
              <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Date:</span>{" "}
                  <span className="font-medium">{new Date(selectedLog.createdAt).toLocaleString("fr-FR")}</span>
                </div>
                <div>
                  <span className="text-slate-500">Collecteur:</span>{" "}
                  <span className="font-medium">{selectedLog.collectorName ?? "-"}</span>
                </div>
                <div>
                  <span className="text-slate-500">Statut:</span> {getStatusBadge(selectedLog.status)}
                </div>
                <div>
                  <span className="text-slate-500">HTTP:</span> {getHttpCodeBadge(getHttpCode(selectedLog.status))}
                </div>
              </div>
              <div className="rounded-lg bg-slate-900 p-4">
                <pre className="overflow-auto text-xs text-slate-100">
                  {JSON.stringify(
                    viewType === "request" ? selectedLog.requestPayload : selectedLog.responsePayload,
                    null,
                    2
                  ) ?? "null"}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
