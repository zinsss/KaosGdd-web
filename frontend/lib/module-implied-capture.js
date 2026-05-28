const KNOWN_CAPTURE_PREFIX_RE = /^(--\s|-x\s|---\s|--x\s|\^\^|!!|\/\/|\.{3}(?:\s|$)|:::+|==|\+\+|fax:|mail:|\$\$)/i;
const MODULE_CAPTURE_BEHAVIORS = [
  { kind: "task", prefix: "--", requiresAttachedFile: false, paths: ["/tasks"] },
  { kind: "event", prefix: "^^", requiresAttachedFile: false, paths: ["/events"] },
  { kind: "reminder", prefix: "!!", requiresAttachedFile: false, paths: ["/reminders"] },
  { kind: "journal", prefix: "//", requiresAttachedFile: false, paths: ["/journal", "/journals"] },
  { kind: "scribble", prefix: "...", requiresAttachedFile: false, paths: ["/scribble"] },
  { kind: "supply", prefix: "$$", requiresAttachedFile: false, paths: ["/supplies"] },
  { kind: "note", prefix: ":::", requiresAttachedFile: false, paths: ["/notes"] },
  { kind: "file", prefix: "++", requiresAttachedFile: true, paths: ["/files"] },
  { kind: "fax", prefix: "fax:", requiresAttachedFile: true, paths: ["/fax"] },
];

export function isKnownCaptureGrammar(rawText) {
  const firstLine = String(rawText || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return Boolean(firstLine && KNOWN_CAPTURE_PREFIX_RE.test(firstLine));
}

function pathMatchesModule(path, modulePath) {
  return path === modulePath || path.startsWith(`${modulePath}/`);
}

export function moduleCaptureBehaviorFromPathname(pathname) {
  const path = String(pathname || "").toLowerCase();
  for (const behavior of MODULE_CAPTURE_BEHAVIORS) {
    if (behavior.paths.some((modulePath) => pathMatchesModule(path, modulePath))) {
      return {
        kind: behavior.kind,
        prefix: behavior.prefix,
        requiresAttachedFile: behavior.requiresAttachedFile,
      };
    }
  }
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

function applyNoteImpliedGrammar(rawText) {
  const raw = String(rawText || "").replace(/\r\n/g, "\n").trim();
  const lines = splitNonEmptyLines(raw);
  const title = lines[0] || raw;
  const body = lines.length > 1 ? lines.slice(1).join("\n") : raw;
  return [":::", `title: ${title}`, "tags:", "link:", ":::", body].join("\n").trim();
}

export function applyModuleImpliedGrammar(pathname, rawText, options = {}) {
  const raw = String(rawText || "").replace(/\r\n/g, "\n").trim();
  if (!raw) return raw;
  if (options.isEditing) return raw;
  if (isKnownCaptureGrammar(raw)) return raw;
  const behavior = moduleCaptureBehaviorFromPathname(pathname);
  if (!behavior) return raw;
  if (options.hasAttachedFile && !behavior.requiresAttachedFile) return raw;
  if (!options.hasAttachedFile && behavior.requiresAttachedFile) return raw;

  switch (behavior.kind) {
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
    case "supply":
      return `$$ ${raw}`;
    case "note":
      return applyNoteImpliedGrammar(raw);
    case "file":
      return `++ ${raw}`;
    case "fax":
      return `fax:${raw}`;
    default:
      return raw;
  }
}
