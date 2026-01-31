import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ActionForm } from "@/components/ui/action-form";
import { updateSettings } from "./actions";

export default async function AdminSettingsPage() {
  const settings = await prisma.appSetting.findFirst();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Paramètres généraux</h1>
        <p className="text-sm text-muted-foreground">Configuration de la commune et des préférences globales.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <a href="/admin/settings/assessments">Modèle avis d&apos;imposition</a>
        </Button>
        <Button asChild variant="outline">
          <a href="/admin/settings/smtp">Configuration SMTP</a>
        </Button>
        <Button asChild variant="outline">
          <a href="/admin/settings/api">URL de base API</a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Profil de la commune</h2>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={updateSettings}
            className="grid gap-3 md:grid-cols-2"
            successMessage="Paramètres enregistrés."
          >
            <Input
              name="municipalityName"
              placeholder="Nom de la commune"
              defaultValue={settings?.municipalityName ?? ""}
              required
            />
            <div className="md:col-span-2 grid gap-2 md:grid-cols-[1fr_2fr]">
              <Input name="logoFile" type="file" accept="image/*" />
              <Input
                name="municipalityLogo"
                placeholder="URL du logo (optionnel)"
                defaultValue={settings?.municipalityLogo ?? ""}
              />
            </div>
            <div className="md:col-span-2 grid gap-3 md:grid-cols-2">
              <label className="text-sm text-muted-foreground">
                Couleur principale
                <Input
                  name="primaryColor"
                  type="color"
                  defaultValue={settings?.primaryColor ?? "#0f172a"}
                  className="mt-2 h-10 w-full"
                />
              </label>
              <label className="text-sm text-muted-foreground">
                Couleur de fond
                <Input
                  name="backgroundColor"
                  type="color"
                  defaultValue={settings?.backgroundColor ?? "#ffffff"}
                  className="mt-2 h-10 w-full"
                />
              </label>
              <label className="text-sm text-muted-foreground">
                Couleur du texte
                <Input
                  name="foregroundColor"
                  type="color"
                  defaultValue={settings?.foregroundColor ?? "#0f172a"}
                  className="mt-2 h-10 w-full"
                />
              </label>
              <label className="text-sm text-muted-foreground">
                Couleur secondaire
                <Input
                  name="mutedColor"
                  type="color"
                  defaultValue={settings?.mutedColor ?? "#f1f5f9"}
                  className="mt-2 h-10 w-full"
                />
              </label>
              <label className="text-sm text-muted-foreground">
                Couleur des bordures
                <Input
                  name="borderColor"
                  type="color"
                  defaultValue={settings?.borderColor ?? "#e2e8f0"}
                  className="mt-2 h-10 w-full"
                />
              </label>
            </div>
            <Input
              name="defaultCurrency"
              placeholder="Devise (ex: XOF)"
              defaultValue={settings?.defaultCurrency ?? "XOF"}
              required
            />
            <Input
              name="timezone"
              placeholder="Fuseau horaire"
              defaultValue={settings?.timezone ?? "Africa/Niamey"}
              required
            />
            <Input
              name="receiptFooter"
              placeholder="Pied de reçu"
              defaultValue={settings?.receiptFooter ?? ""}
              className="md:col-span-2"
            />
            <Button type="submit" className="md:col-span-2">
              Sauvegarder
            </Button>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
