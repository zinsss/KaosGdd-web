export function getSuppliesApiBase() {
  return process.env.SUPPLIES_API_BASE || "http://127.0.0.1:8008";
}
