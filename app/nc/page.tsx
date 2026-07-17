import { ExtractorPage } from "@/components/upload/ExtractorPage";

export default function NcPage() {
  return (
    <ExtractorPage
      service="nc"
      title="Nominal Code Extractor"
      description="Select a company, then upload a single-sheet expense file (row 1 = headers with Details and N/C). Output: Details, N/C."
    />
  );
}
