import { useLocalSearchParams } from "expo-router";
import { AnalyticsReportScreen } from "@/screens/AnalyticsReportScreen";

export default function AnalyticsReportRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AnalyticsReportScreen reportId={String(id || "")} />;
}
