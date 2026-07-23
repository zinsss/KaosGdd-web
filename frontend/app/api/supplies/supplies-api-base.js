export function getSuppliesApiBase() {
  return process.env.SUPPLIES_API_BASE || "http://kaossupplies-api:8000";
}
