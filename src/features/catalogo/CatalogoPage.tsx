import { useSearchParams } from "react-router-dom";
import { Page } from "@/components/ui/Page";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { LocationsPanel } from "@/features/locais/LocationsPanel";
import { ProductsPanel } from "@/features/produtos/ProductsPanel";

type CatalogoTab = "produtos" | "locais";

export function CatalogoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: CatalogoTab = searchParams.get("tab") === "locais" ? "locais" : "produtos";

  return (
    <Page title="Catálogo" eyebrow="Produtos e locais">
      <SegmentedControl
        value={tab}
        onChange={(next) => setSearchParams(next === "produtos" ? {} : { tab: next }, { replace: true })}
        options={[
          { value: "produtos", label: "Produtos" },
          { value: "locais", label: "Locais" }
        ]}
        className="max-w-md"
      />
      {tab === "produtos" ? <ProductsPanel /> : <LocationsPanel />}
    </Page>
  );
}
