import { normalizeModuleNavStatus } from "./module-nav-status.js";

export const APP_HEADER_TITLE_BASE_CLASS = "appHeaderTitle appHeaderTitleLink";

export function hasStrongTitleAttention(status) {
  return normalizeModuleNavStatus(status).has_strong_attention;
}

export function getAppHeaderTitleClassName(status) {
  return APP_HEADER_TITLE_BASE_CLASS + (hasStrongTitleAttention(status) ? " appHeaderTitleAttention" : "");
}
