const EVENT_COUNT_GLYPHS = {
  1: "➊",
  2: "➋",
  3: "➌",
  4: "➍",
  5: "➎",
  6: "➏",
  7: "➐",
  8: "➑",
  9: "➒",
};

export function formatEventCountGlyph(count) {
  const normalizedCount = Number(count || 0);
  if (!normalizedCount || normalizedCount <= 0) return "";
  if (normalizedCount >= 10) return "➓";
  return EVENT_COUNT_GLYPHS[normalizedCount] || "";
}
