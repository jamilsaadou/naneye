import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ActionForm } from "@/components/ui/action-form";
import { updateSmtpSettings } from "./actions";

export default async function SmtpSettingsPage() {
  const settings = await prisma.appSetting.findFirst();
  const configured = Boolean(settings?.smtpHost && settings?.smtpPort && settings?.smtpFrom);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Configuration SMTP</h1>
          <p className="text-sm text-muted-foreground">
            Envoi automatique des mots de passe collecteurs par email.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="/admin/settings">Retour</a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Connexion SMTP</h2>
          <p className="text-sm text-muted-foreground">
            {configured ? "SMTP configuré" : "SMTP non configuré"} · Le mot de passe n&apos;est jamais affiché.
          </p>
        </CardHeader>
        <CardContent>
          <ActionForm action={updateSmtpSettings} className="grid gap-3 md:grid-cols-2">
            <Input name="smtpHost" placeholder="Serveur SMTP" defaultValue={settings?.smtpHost ?? ""} required />
            <Input
              name="smtpPort"
              placeholder="Port"
              type="number"
              defaultValue={settings?.smtpPort ?? 587}
              required
            />
            <Input name="smtpUser" placeholder="Utilisateur" defaultValue={settings?.smtpUser ?? ""} />
            <Input
              name="smtpPassword"
              placeholder="Mot de passe (laisser vide pour conserver)"
              type="password"
            />
            <Input
              name="smtpFrom"
              placeholder="Email expéditeur (ex: Commune <no-reply@domaine.com>)"
              defaultValue={settings?.smtpFrom ?? ""}
              className="md:col-span-2"
              required
            />
            <Input
              name="testEmail"
              placeholder="Email de test (optionnel)"
              type="email"
              className="md:col-span-2"
            />
            <label className="md:col-span-2 flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                name="smtpSecure"
                defaultChecked={settings?.smtpSecure ?? false}
                className="h-4 w-4 rounded border-slate-300"
              />
              Utiliser SSL/TLS (port 465 généralement)
            </label>
            <div className="md:col-span-2 flex flex-wrap gap-2">
              <Button type="submit" name="intent" value="test" variant="outline">
                Tester la connexion
              </Button>
              <Button type="submit" name="intent" value="save">
                Enregistrer
              </Button>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
