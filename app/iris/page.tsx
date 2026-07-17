import { ExtractorPage } from "@/components/upload/ExtractorPage";

export default function IrisPage() {
  return (
    <ExtractorPage
      service="iris"
      title="IRIS Extractor"
      description="Select a company, then upload a single-sheet bank file (row 1 = headers). Output: Particular, IRIS Code, Type, Notes."
    />
  );
}
