import SuppliesPageClient from "../../components/SuppliesPageClient";

const SUPPLY_MODES = ["active", "done"];

export default function SuppliesPage({ searchParams }) {
  const mode = SUPPLY_MODES.includes(searchParams?.mode) ? searchParams.mode : "active";
  return <SuppliesPageClient initialMode={mode} />;
}
