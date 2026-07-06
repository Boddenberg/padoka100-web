import { useState } from "react";
import type { ReactNode } from "react";

interface ProductImageProps {
  src: string | null;
  fallback: ReactNode;
  className?: string;
}

export function ProductImage({ src, fallback, className }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) return <>{fallback}</>;

  return <img src={src} alt="" className={className} loading="lazy" onError={() => setFailed(true)} />;
}
