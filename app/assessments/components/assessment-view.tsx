import { AppSetting, Notice, NoticeLine, Taxpayer } from "@prisma/client";
import Image from "next/image";

function formatNumber(value: number) {
  const formatted = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
  return formatted.replace(/[\s\u202f\u00a0]/g, ".");
}

function formatMoney(value: number) {
  return `${formatNumber(value)} FCFA`;
}

function formatDate(value: Date) {
  return value.toLocaleDateString("fr-FR");
}

function formatTime(value: Date) {
  return value.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function renderTemplateImage(value: string | null, heightMm: number) {
  if (!value) return null;
  return (
    <div className="relative w-full" style={{ height: `${heightMm}mm` }}>
      <Image
        src={value}
        alt="Template"
        fill
        sizes="100vw"
        style={{ objectFit: "contain" }}
        unoptimized
      />
    </div>
  );
}

export function AssessmentView({
  notice,
  taxpayer,
  lines,
  settings,
  qrSvg,
  digitalUrl,
  variant = "print",
}: {
  notice: Notice;
  taxpayer: Taxpayer;
  lines: NoticeLine[];
  settings: AppSetting | null;
  qrSvg: string;
  digitalUrl: string;
  variant?: "print" | "digital";
}) {
  const header = settings?.assessmentHeader ?? null;
  const footer = settings?.assessmentFooter ?? null;
  const title = `AVIS D'IMPOSITION - ANNEE ${notice.year}`;
  const infoRow = (label: string, value: string) => (
    <div className="grid grid-cols-[1fr_120px] items-center gap-2">
      <span className="font-semibold text-emerald-800">{label}</span>
      <span className="rounded-sm bg-slate-100 px-2 py-0.5 text-right font-semibold text-slate-900">
        {value}
      </span>
    </div>
  );

  return (
    <div className={variant === "print" ? "assessment-page" : "space-y-4"}>
      <div className="assessment-sheet mx-auto w-full bg-white text-slate-900 shadow-sm">
        <div className="assessment-header border-b border-slate-200">
          {header ? (
            <div className="px-0 py-0">{renderTemplateImage(header, 50)}</div>
          ) : (
            <div className="flex items-center justify-between gap-6 px-8 py-4 text-sm">
              <div className="flex items-center gap-4">
                {settings?.municipalityLogo ? (
                  <Image
                    src={settings.municipalityLogo}
                    alt="Logo"
                    width={64}
                    height={64}
                    className="h-16 w-16 object-contain"
                    unoptimized
                  />
                ) : null}
                <div className="text-xs font-semibold uppercase text-slate-600">Republique du Niger</div>
              </div>
              <div className="text-center">
                <div className="text-xs font-semibold uppercase text-emerald-800">Region de {taxpayer.commune}</div>
                <div className="text-xs font-semibold uppercase text-emerald-800">Ville de {taxpayer.commune}</div>
              </div>
              {settings?.municipalityLogo ? (
                <Image
                  src={settings.municipalityLogo}
                  alt="Logo"
                  width={64}
                  height={64}
                  className="h-16 w-16 object-contain"
                  unoptimized
                />
              ) : (
                <div className="h-16 w-16" />
              )}
            </div>
          )}
        </div>

        <div className="bg-amber-500 px-6 py-2 text-center text-base font-semibold uppercase tracking-wide text-white">
          {title}
        </div>

        <div className="assessment-content grid gap-3 px-6 py-4 [grid-template-columns:1.05fr_1fr] text-[11px] leading-5">
          <div className="rounded-md border border-emerald-200 px-3 py-2">
            <div className="mb-2 text-center font-semibold text-emerald-800">Informations sur le contribuable</div>
            <div className="grid gap-1">
              {infoRow("Designation du contribuable :", taxpayer.name)}
              {infoRow("Secteur d'activite :", taxpayer.category ?? "-")}
              {infoRow("Telephone :", taxpayer.phone ?? "-")}
              {infoRow("Adresse :", taxpayer.address ?? taxpayer.commune)}
            </div>
          </div>

          <div className="rounded-md border border-emerald-200 px-3 py-2">
            <div className="grid gap-1">
              {infoRow("Numero d'avis d'imposition :", notice.number)}
              {infoRow("Code contribuable :", taxpayer.code ?? "-")}
            </div>
            <div className="mt-2 grid gap-1 border-t border-emerald-100 pt-2">
              {infoRow("Date d'exigibilite :", formatDate(notice.periodStart))}
              {infoRow("Date de majoration :", "-")}
              {infoRow("Date de mise en recouvrement :", formatDate(notice.createdAt))}
              {infoRow("Arrondissement communal :", taxpayer.neighborhood)}
            </div>
          </div>
        </div>

        <div className="px-8">
          <div className="text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
            Articles 2 et 3 de la Loi n° 2012 - 37 du 20 Juin 2012, portant Code General des impots
          </div>
          <div className="mt-3 overflow-hidden rounded-md border border-emerald-700">
            <table className="w-full table-fixed text-[11px] leading-4">
              <thead className="bg-emerald-800 text-white">
                <tr>
                  <th className="w-[38%] px-3 py-2 text-left">Nature des contributions et taxes</th>
                  <th className="w-[32%] px-3 py-2 text-left">Base et detail des contributions et taxes</th>
                  <th className="w-[15%] px-3 py-2 text-right">Montant</th>
                  <th className="w-[15%] px-3 py-2 text-left">Observations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-200">
                {lines.map((line) => {
                  const base = Number(line.baseAmount);
                  const rate = Number(line.taxRate);
                  return (
                    <tr key={line.id}>
                      <td className="px-3 py-2">{line.taxLabel}</td>
                      <td className="px-3 py-2">
                        {base > 0 ? `${formatMoney(rate)} * ${formatNumber(base)}` : "-"}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">{formatMoney(Number(line.amount))}</td>
                      <td className="px-3 py-2" />
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-emerald-600">
                  <td className="px-3 py-2 font-semibold" colSpan={2}>TOTAL</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatMoney(Number(notice.totalAmount))}</td>
                  <td className="px-3 py-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="px-8 pt-6 text-xs text-slate-600">
          NB : En cas de contestation, renseignez-vous aupres du service gestionnaire de votre dossier fiscal.
        </div>

        <div className="flex items-center justify-between px-8 pt-20 pb-20 text-sm">
          <div className="font-semibold">Le Regisseur</div>
          <div className="font-semibold">Le Maire</div>
        </div>

        <div className="assessment-bottom">
          <div className="mt-6 border-t border-slate-200 px-8 py-4 text-xs">
            <div className="mx-auto grid w-[100mm] grid-cols-[1fr_12mm] items-center gap-[1.5mm]">
              <div className="min-w-0 space-y-1">
                <div>Numero d&apos;avis d&apos;imposition : {notice.number}</div>
                <div>Date de generation : {formatDate(notice.createdAt)}</div>
                <div>Heure : {formatTime(notice.createdAt)}</div>
                <div>Arrondissement communal : {taxpayer.neighborhood}</div>
                <div className="text-[10px] text-slate-500">Version digitale via QR.</div>
              </div>
              <div
                className="qr-box h-[12mm] w-[12mm] justify-self-start overflow-hidden rounded border border-slate-200 bg-white p-[0.5mm]"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            </div>
          </div>

          {footer ? (
            <div className="assessment-footer">{renderTemplateImage(footer, 30)}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
