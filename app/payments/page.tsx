import { PaymentFlow } from "./payment-flow";

export default function PaymentsPage({ searchParams }: { searchParams?: { code?: string; notice?: string } }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Encaissements</h1>
        <p className="text-sm text-muted-foreground">
          Encaisser un paiement a partir du code contribuable et du numero d&apos;avis.
        </p>
      </div>
      <PaymentFlow defaultCode={searchParams?.code ?? ""} defaultNotice={searchParams?.notice ?? ""} />
    </div>
  );
}
