import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { calculateAllTaxNotices } from "../actions";
import { CalculationForm } from "@/components/ui/calculation-form";
import { Button } from "@/components/ui/button";

export default function CalculationsPage() {
  const currentYear = new Date().getFullYear();
  const startYear = 2025;
  const endYear = Math.max(currentYear, startYear) + 5;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Calcul global</h1>
          <p className="text-sm text-muted-foreground">Lancer les calculs d&apos;avis pour tous les contribuables.</p>
        </div>
        <Button asChild variant="outline">
          <a href="/admin/settings">Retour</a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Lancer un calcul</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Cette action calcule un nouvel avis pour chaque contribuable en fonction des mesures et categories.
          </p>
          <CalculationForm
            action={calculateAllTaxNotices}
            buttonLabel="Calculer tous les avis"
            pendingLabel="Calcul en cours..."
            variant="outline"
          >
            <label className="text-sm font-medium text-slate-900">
              Année
              <select
                name="year"
                defaultValue={String(currentYear)}
                required
                className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
              >
                {Array.from({ length: endYear - startYear + 1 }).map((_, index) => {
                  const year = startYear + index;
                  return (
                    <option key={year} value={String(year)}>
                      {year}
                    </option>
                  );
                })}
              </select>
            </label>
          </CalculationForm>
        </CardContent>
      </Card>
    </div>
  );
}
