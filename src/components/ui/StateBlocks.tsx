import type { ReactNode } from "react";
import { AlertTriangle, Loader2, PackageOpen } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function LoadingState({ label = "Carregando" }: { label?: string }) {
  return (
    <Card className="flex min-h-36 items-center justify-center gap-3 p-6 text-slate-600">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="font-semibold">{label}</span>
    </Card>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <Card className="grid justify-items-center gap-3 p-6 text-center">
      <PackageOpen className="h-9 w-9 text-slate-400" />
      <div>
        <h3 className="text-lg font-bold text-slate-950">{title}</h3>
        {description ? <p className="mt-1 text-sm font-medium text-slate-500">{description}</p> : null}
      </div>
      {action}
    </Card>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="grid gap-3 border-rose-200 bg-rose-50 p-4 text-rose-900">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="font-semibold">{message}</p>
      </div>
      {onRetry ? (
        <Button type="button" variant="secondary" onClick={onRetry}>
          Tentar novamente
        </Button>
      ) : null}
    </Card>
  );
}
