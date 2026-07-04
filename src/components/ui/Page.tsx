import type { ReactNode } from "react";

interface PageProps {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function Page({ title, eyebrow, action, children }: PageProps) {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-4 sm:px-6 lg:py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow ? <p className="text-xs font-bold uppercase tracking-wide text-red-600">{eyebrow}</p> : null}
          <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">{title}</h1>
        </div>
        {action}
      </header>
      {children}
    </div>
  );
}
