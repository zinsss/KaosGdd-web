const KNOWN_CAPTURE_PREFIX_RE = /^(--\s|-x\s|---\s|--x\s|\^\^|!!|\/\/|\.{3}(?:\s|$)|:::+|==|\+\+|fax:|mail:|\$\$)/i;

export function isKnownCaptureGrammar(rawText) {
  const firstLine = String(rawText || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return Boolean(firstLine && KNOWN_CAPTURE_PREFIX_RE.test(firstLine));
}

function moduleKindFromPathname(pathname) {
  const path = String(pathname || "").toLowerCase();
  if (path === "/tasks" || path.startsWith("/tasks/")) return "task";
  if (path === "/events" || path.startsWith("/events/")) return "event";
  if (path === "/reminders" || path.startsWith("/reminders/")) return "reminder";
  if (path === "/journal" || path.startsWith("/journal/") || path === "/journals" || path.startsWith("/journals/")) return "journal";
  if (path === "/scribble" || path.startsWith("/scribble/")) return "scribble";
  return null;
}

function splitNonEmptyLines(rawText) {
  return String(rawText || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function applyEventImpliedGrammar(rawText) {
  const lines = splitNonEmptyLines(rawText);
  const title = lines[0] || "";
  const rest = lines.slice(1);
  const dateIndex = rest.findIndex((line) => line.startsWith("d:"));
  if (dateIndex < 0) return `^^ ${String(rawText || "").trim()}`;

  const dateValue = rest[dateIndex].slice(2).trim();
  const after = rest.filter((_, index) => index !== dateIndex);
  return [`^^ ${dateValue} ${title}`.trim(), ...after].join("\n");
}

export function applyModuleImpliedGrammar(pathname, rawText, options = {}) {
  const raw = String(rawText || "").replace(/\r\n/g, "\n").trim();
  if (!raw) return raw;
  if (options.isEditing || options.hasAttachedFile) return raw;
  if (isKnownCaptureGrammar(raw)) return raw;

  switch (moduleKindFromPathname(pathname)) {
    case "task":
      return `-- ${raw}`;
    case "event":
      return applyEventImpliedGrammar(raw);
    case "reminder":
      return `!! ${raw}`;
    case "journal":
      return `// ${raw}`;
    case "scribble":
      return `... ${raw}`;
    default:
      return raw;
  }
}
