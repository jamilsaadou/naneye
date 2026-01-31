import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ActionForm } from "@/components/ui/action-form";
import { updateApiSettings } from "./actions";

export default async function ApiSettingsPage() {
  const settings = await prisma.appSetting.findFirst();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">URL de base API</h1>
          <p className="text-sm text-muted-foreground">
            Utilisée pour documenter les endpoints sans afficher l&apos;URL de la plateforme.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="/admin/settings">Retour</a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Configuration</h2>
          <p className="text-sm text-muted-foreground">Exemple: https://plateforme.domaine.com</p>
        </CardHeader>
        <CardContent>
          <ActionForm action={updateApiSettings} className="grid gap-3">
            <Input
              name="apiBaseUrl"
              placeholder="https://plateforme.domaine.com"
              defaultValue={settings?.apiBaseUrl ?? ""}
            />
            <Button type="submit">Enregistrer</Button>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
