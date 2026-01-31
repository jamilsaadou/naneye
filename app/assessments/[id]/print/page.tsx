import { prisma } from "@/lib/prisma";
import { encryptAssessmentToken } from "@/lib/assessment-crypto";
import { renderQrSvg } from "@/lib/qrcode";
import { AssessmentView } from "@/app/assessments/components/assessment-view";
import { AssessmentToolbar } from "@/app/assessments/components/assessment-toolbar";

export default async function AssessmentPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [notice, settings] = await Promise.all([
    prisma.notice.findUnique({
      where: { id },
      include: { taxpayer: true, lines: true },
    }),
    prisma.appSetting.findFirst(),
  ]);

  if (!notice) {
    return <div className="p-6 text-sm text-muted-foreground">Avis introuvable.</div>;
  }

  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  const token = encryptAssessmentToken(notice.id);
  const digitalUrl = `${baseUrl}/assessments/digital?token=${token}`;
  const qrSvg = await renderQrSvg(digitalUrl);

  return (
    <>
      <AssessmentToolbar pdfHref={`/assessments/${id}/pdf`} />
      <style>{`
        @page { size: A4; margin: 0; }
        .assessment-sheet {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          box-shadow: none;
        }
        .qr-box svg {
          width: 100%;
          height: 100%;
          display: block;
        }
        @media screen {
          .assessment-sheet {
            width: 210mm;
            min-height: 297mm;
          }
        }
        @media print {
          body { background: #ffffff; }
          .assessment-page { padding: 0; }
          .assessment-sheet {
            height: 297mm;
            display: flex;
            flex-direction: column;
          }
          .assessment-header,
          .assessment-footer {
            flex-shrink: 0;
          }
          .assessment-content {
            flex: 1 1 auto;
            align-content: start;
          }
          .assessment-bottom {
            margin-top: auto;
          }
        }
      `}</style>
      <AssessmentView
        notice={notice}
        taxpayer={notice.taxpayer}
        lines={notice.lines}
        settings={settings}
        qrSvg={qrSvg}
        digitalUrl={digitalUrl}
        variant="print"
      />
    </>
  );
}
