import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateAssessmentTemplate } from "./actions";

function renderTemplate(value: string | null, heightMm: number) {
  if (!value) {
    return <div className="text-xs text-slate-400 italic">Aucune image definie</div>;
  }
  return (
    <img
      src={value}
      alt="Template"
      style={{ height: `${heightMm}mm`, width: "100%", objectFit: "contain" }}
    />
  );
}

export default async function AssessmentSettingsPage() {
  const settings = await prisma.appSetting.findFirst();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Avis d&apos;imposition (A4)</h1>
          <p className="text-sm text-muted-foreground">
            Personalisez l&apos;entete et le pied de page. Les autres informations restent dynamiques.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="/admin/settings">Retour</a>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Configuration</h2>
            <p className="text-sm text-muted-foreground">
              Entete: 20cm x 5cm. Pied de page: 21cm x 3cm.
            </p>
          </CardHeader>
          <CardContent>
            <ActionForm
              action={updateAssessmentTemplate}
              className="grid gap-4"
              successMessage="Modèle d&apos;avis enregistré."
            >
              <label className="text-sm font-medium text-slate-900">
                Entete
                <Input name="assessmentHeaderFile" type="file" accept="image/*" className="mt-2" />
                <Input
                  name="assessmentHeader"
                  defaultValue={settings?.assessmentHeader ?? ""}
                  placeholder="URL de l&apos;entete (optionnel)"
                  className="mt-2"
                />
                <div className="mt-1 text-xs text-slate-500">Dimension recommandee: 20cm x 5cm.</div>
              </label>
              <label className="text-sm font-medium text-slate-900">
                Pied de page
                <Input name="assessmentFooterFile" type="file" accept="image/*" className="mt-2" />
                <Input
                  name="assessmentFooter"
                  defaultValue={settings?.assessmentFooter ?? ""}
                  placeholder="URL du pied de page (optionnel)"
                  className="mt-2"
                />
                <div className="mt-1 text-xs text-slate-500">Dimension recommandee: 21cm x 3cm.</div>
              </label>
              <div className="flex justify-end">
                <Button type="submit">Enregistrer</Button>
              </div>
            </ActionForm>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Apercu A4</h2>
            <p className="text-sm text-muted-foreground">Apercu visuel (non imprime).</p>
          </CardHeader>
          <CardContent>
            <div className="max-h-[70vh] overflow-auto rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <div className="mx-auto w-[210mm] min-h-[297mm] rounded-md border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 p-6 text-sm text-slate-900">
                  {renderTemplate(settings?.assessmentHeader ?? null, 50)}
                </div>
                <div className="p-6 text-sm text-slate-500">
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-xs uppercase tracking-wide text-slate-400">
                    Contenu dynamique de l&apos;avis (taxes, montants, contribuable...)
                  </div>
                </div>
                <div className="mt-20 border-t border-slate-200 p-6 text-sm text-slate-900">
                  {renderTemplate(settings?.assessmentFooter ?? null, 30)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
