const POST_CREATE_PRIORITY = ["task", "event", "reminder", "supply", "scribble", "journal", "note", "file", "fax"];

const POST_CREATE_HOME_PATHS = {
  task: "/tasks",
  event: "/events",
  reminder: "/reminders",
  supply: "/supplies",
  scribble: "/scribble",
  journal: "/journals",
  note: "/notes",
  file: "/files",
  fax: "/fax",
};

const KIND_ALIASES = {
  simple_reminder: "reminder",
  reminders: "reminder",
  supplies: "supply",
  journals: "journal",
  scribbles: "scribble",
  notes: "note",
  files: "file",
  faxes: "fax",
};

export function normalizeCreatedItemType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return KIND_ALIASES[normalized] || normalized;
}

export function primaryCreatedItemType(createdTypes) {
  const normalizedTypes = new Set(
    (Array.isArray(createdTypes) ? createdTypes : [createdTypes])
      .map(normalizeCreatedItemType)
      .filter(Boolean),
  );

  return POST_CREATE_PRIORITY.find((type) => normalizedTypes.has(type)) || null;
}

export function postCreateDestination(createdTypes) {
  const primaryType = primaryCreatedItemType(createdTypes);
  return primaryType ? POST_CREATE_HOME_PATHS[primaryType] || null : null;
}

export function createdTypesFromCaptureResponse(data) {
  if (!data || typeof data !== "object") return [];

  const types = [];
  if (Array.isArray(data.created_types)) types.push(...data.created_types);
  if (Array.isArray(data.createdTypes)) types.push(...data.createdTypes);
  if (Array.isArray(data.items)) {
    for (const item of data.items) {
      if (typeof item === "string") {
        types.push(item);
      } else if (item && typeof item === "object") {
        types.push(item.kind || item.type || item.item_type);
      }
    }
  }
  types.push(data.primary_kind || data.primaryType || data.kind || data.type || data.item_type);
  return types.filter(Boolean);
}

function normalizedCreatedTypes(createdTypes) {
  return (Array.isArray(createdTypes) ? createdTypes : [createdTypes])
    .map(normalizeCreatedItemType)
    .filter(Boolean);
}

export function dispatchCaptureCreated(createdTypes) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("kaosgdd:capture-created", {
      detail: { createdTypes: normalizedCreatedTypes(createdTypes) },
    }),
  );
}

export function captureCreatedEventHasType(event, type) {
  const wantedType = normalizeCreatedItemType(type);
  const createdTypes = event?.detail?.createdTypes;
  return Array.isArray(createdTypes) && createdTypes.some((value) => normalizeCreatedItemType(value) === wantedType);
}

export function navigateAfterCreate(router, createdTypes) {
  const destination = postCreateDestination(createdTypes);
  if (!destination) return false;

  router.push(destination);
  if (typeof window !== "undefined") {
    window.setTimeout(() => router.refresh?.(), 0);
  } else {
    router.refresh?.();
  }
  return true;
}
