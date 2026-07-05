import type { ReactNode } from "react";
import { AlertTriangle, Loader2, PackageOpen, Wheat } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function LoadingState({ label = "Carregando" }: { label?: string }) {
  return (
    <Card className="flex min-h-28 items-center justify-center gap-3 p-5 text-bakery-muted">
      <Loader2 className="h-5 w-5 animate-spin text-bakery-brand" />
      <span className="font-semibold">{label}</span>
    </Card>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <Card className="grid justify-items-center gap-3 p-5 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-bakery-soft text-bakery-brand">
        <PackageOpen className="h-6 w-6" />
      </div>
      <div>
        <h3 className="text-lg font-black text-bakery-ink">{title}</h3>
        {description ? <p className="mt-1 text-sm font-medium leading-relaxed text-bakery-muted">{description}</p> : null}
      </div>
      {action}
    </Card>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="grid gap-3 border-bakery-danger/20 bg-bakery-dangerSoft p-4 text-bakery-danger">
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

export function FriendlyHint({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-bakeryLg bg-bakery-cream p-4 text-base font-semibold text-bakery-muted">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-bakery-brand shadow-soft">
        <Wheat className="h-5 w-5" />
      </div>
      <p>{children}</p>
    </div>
  );
}
