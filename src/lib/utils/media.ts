import { getBackendTargetUrl } from "@/lib/config/apiSettings";

export function resolveMediaUrl(url: string | null | undefined) {
  if (!url) return null;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return new URL(url, `${getBackendTargetUrl()}/`).toString();
}
