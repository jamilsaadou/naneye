import { prisma } from "@/lib/prisma";
import { getUserWithCommune } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ManualPaymentForm } from "./manual-payment-form";
import { normalizeUploadUrl } from "@/lib/uploads";

function formatNumber(value: number) {
  const formatted = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
  return formatted.replace(/[\s\u202f\u00a0]/g, ".");
}

function formatMoney(value: number) {
  return `${formatNumber(value)} FCFA`;
}

export default async function TaxpayerPaymentsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUserWithCommune();
  const scopedCommune = user?.role === "SUPER_ADMIN" ? null : user?.commune?.name ?? null;

  const resolvedParams = await params;

  const taxpayer = await prisma.taxpayer.findUnique({
    where: { id: resolvedParams.id },
  });

  if (!taxpayer) {
    return <div className="text-sm text-muted-foreground">Contribuable introuvable.</div>;
  }
  if (scopedCommune && taxpayer.commune !== scopedCommune) {
    return <div className="text-sm text-muted-foreground">Acces refuse pour cette commune.</div>;
  }

  const [notices, payments] = await Promise.all([
    prisma.notice.findMany({
      where: { taxpayerId: taxpayer.id },
      orderBy: { periodStart: "desc" },
    }),
    prisma.payment.findMany({
      where: { notice: { taxpayerId: taxpayer.id } },
      include: { collector: true, notice: true },
      orderBy: { paidAt: "desc" },
      take: 200,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Paiements</h1>
          <p className="text-sm text-muted-foreground">{taxpayer.name}</p>
        </div>
        <Button asChild variant="outline">
          <a href={`/taxpayers/${taxpayer.id}`}>Retour</a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Encaisser un paiement</h2>
        </CardHeader>
        <CardContent>
          <ManualPaymentForm
            taxpayerId={taxpayer.id}
            notices={notices.map((notice) => ({
              id: notice.id,
              number: notice.number,
              year: notice.year,
              totalAmount: Number(notice.totalAmount),
              amountPaid: Number(notice.amountPaid),
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Historique des paiements</h2>
            <span className="text-sm text-muted-foreground">{formatNumber(payments.length)} enregistrements</span>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Collecteur</TableHead>
                <TableHead>Avis</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Methode</TableHead>
                <TableHead>Preuve</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{new Date(payment.paidAt).toLocaleString("fr-FR")}</TableCell>
                  <TableCell>{payment.collector?.name ?? "Interne"}</TableCell>
                  <TableCell>{payment.notice.number}</TableCell>
                  <TableCell>{formatMoney(Number(payment.amount))}</TableCell>
                  <TableCell>{payment.method}</TableCell>
                  <TableCell>
                    {payment.proofUrl ? (
                      <a
                        href={normalizeUploadUrl(payment.proofUrl) ?? payment.proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-xs text-emerald-700 hover:underline"
                      >
                        <Image
                          src={normalizeUploadUrl(payment.proofUrl) ?? payment.proofUrl}
                          alt="Preuve"
                          width={32}
                          height={32}
                          className="h-8 w-8 rounded object-cover"
                          unoptimized
                        />
                        Voir
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    Aucun paiement enregistre.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
