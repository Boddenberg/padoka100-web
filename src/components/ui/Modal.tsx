import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, open, onClose, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-bakery-ink/45 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
      <section className="max-h-[92vh] w-full overflow-y-auto rounded-t-bakeryXl bg-white shadow-floating sm:max-w-2xl sm:rounded-bakeryXl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-bakery-border bg-white/95 p-4">
          <h2 className="text-xl font-black text-bakery-ink">{title}</h2>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="p-4">{children}</div>
      </section>
    </div>
  );
}
