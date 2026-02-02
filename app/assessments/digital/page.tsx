import { prisma } from "@/lib/prisma";
import { decryptAssessmentToken, encryptAssessmentToken } from "@/lib/assessment-crypto";
import { renderQrSvg } from "@/lib/qrcode";
import { AssessmentView } from "@/app/assessments/components/assessment-view";

export default async function AssessmentDigitalPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params?.token ?? "";
  const noticeId = token ? decryptAssessmentToken(token) : null;

  if (!noticeId) {
    return <div className="p-6 text-sm text-muted-foreground">Lien invalide.</div>;
  }

  const [notice, settings] = await Promise.all([
    prisma.notice.findUnique({
      where: { id: noticeId },
      include: { taxpayer: true, lines: true },
    }),
    prisma.appSetting.findFirst(),
  ]);

  if (!notice) {
    return <div className="p-6 text-sm text-muted-foreground">Avis introuvable.</div>;
  }

  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  const refreshedToken = encryptAssessmentToken(notice.id);
  const digitalUrl = `${baseUrl}/assessments/digital?token=${refreshedToken}`;
  const qrSvg = await renderQrSvg(digitalUrl);

  const totalAmount = Number(notice.totalAmount);
  const amountPaid = Number(notice.amountPaid);
  const remainingAmount = totalAmount - amountPaid;

  const formatMoney = (value: number) =>
    `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value).replace(/[\s\u202f\u00a0]/g, ".")} FCFA`;

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      {/* Résumé rapide pour mobile */}
      <div className="mx-auto mb-4 max-w-md rounded-lg bg-white p-4 shadow-md">
        <h1 className="mb-3 text-center text-lg font-bold text-emerald-800">
          Avis d&apos;Imposition
        </h1>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between border-b border-slate-100 pb-1">
            <span className="text-slate-600">N° Avis :</span>
            <span className="font-semibold">{notice.number}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-1">
            <span className="text-slate-600">Contribuable :</span>
            <span className="font-semibold">{notice.taxpayer.name}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-1">
            <span className="text-slate-600">Code :</span>
            <span className="font-semibold">{notice.taxpayer.code ?? "-"}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-1">
            <span className="text-slate-600">Montant Total :</span>
            <span className="font-semibold">{formatMoney(totalAmount)}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-1">
            <span className="text-slate-600">Montant Payé :</span>
            <span className="font-semibold text-emerald-600">{formatMoney(amountPaid)}</span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="text-slate-600">Reste à Payer :</span>
            <span className={`font-bold ${remainingAmount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
              {formatMoney(remainingAmount)}
            </span>
          </div>
        </div>
        {remainingAmount <= 0 && (
          <div className="mt-3 rounded bg-emerald-100 p-2 text-center text-sm font-semibold text-emerald-800">
            ✓ Avis entièrement payé
          </div>
        )}
      </div>

      <AssessmentView
        notice={notice}
        taxpayer={notice.taxpayer}
        lines={notice.lines}
        settings={settings}
        qrSvg={qrSvg}
        digitalUrl={digitalUrl}
        variant="digital"
      />
    </div>
  );
}
