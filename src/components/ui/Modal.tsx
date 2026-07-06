import { useEffect } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: "md" | "lg" | "full";
  footer?: ReactNode;
  onBack?: () => void;
}

const sizes = {
  md: "max-h-[88vh] sm:max-w-2xl",
  lg: "max-h-[92vh] sm:max-w-3xl",
  full: "max-h-[94vh] sm:max-w-3xl"
};

export function Modal({ title, open, onClose, children, size = "md", footer, onBack }: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-bakery-ink/40 backdrop-blur-sm sm:place-items-center sm:p-4"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "flex w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-floating sm:rounded-bakeryXl",
          sizes[size]
        )}
      >
        <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-bakery-creamStrong sm:hidden" aria-hidden />
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-4 sm:pt-5">
          <div className="flex min-w-0 items-center gap-2">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                aria-label="Voltar"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bakery-creamStrong text-bakery-ink transition active:scale-95"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : null}
            <h2 className="truncate text-xl font-extrabold tracking-tight text-bakery-ink">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bakery-creamStrong text-bakery-ink transition active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-bakery-border/70 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4">
            {footer}
          </div>
        ) : null}
      </section>
    </div>
  );
}
