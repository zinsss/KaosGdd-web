import SuppliesPageClient from "../../components/SuppliesPageClient";

const SUPPLY_MODES = ["active", "done"];

function firstSearchParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SuppliesPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const modeParam = firstSearchParam(resolvedSearchParams?.mode);
  const mode = SUPPLY_MODES.includes(modeParam) ? modeParam : "active";
  return <SuppliesPageClient initialMode={mode} />;
}
