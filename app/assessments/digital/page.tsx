import { prisma } from "@/lib/prisma";
import { decryptAssessmentToken, encryptAssessmentToken } from "@/lib/assessment-crypto";
import { renderQrSvg } from "@/lib/qrcode";
import { AssessmentView } from "@/app/assessments/components/assessment-view";

export default async function AssessmentDigitalPage({
  searchParams,
}: {
  searchParams?: { token?: string };
}) {
  const token = searchParams?.token ?? "";
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

  return (
    <div className="min-h-screen bg-slate-100 p-6">
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
