import type { ReactNode } from "react";

interface PageProps {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function Page({ title, eyebrow, action, children }: PageProps) {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-5 sm:px-6 lg:py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow ? <p className="text-base font-bold text-bakery-brand">{eyebrow}</p> : null}
          <h1 className="text-3xl font-black leading-tight text-bakery-ink sm:text-4xl">{title}</h1>
        </div>
        {action}
      </header>
      {children}
    </div>
  );
}
