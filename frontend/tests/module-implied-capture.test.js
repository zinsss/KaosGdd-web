import test from "node:test";
import assert from "node:assert/strict";

import {
  applyModuleImpliedGrammar,
  moduleCaptureBehaviorFromPathname,
} from "../lib/module-implied-capture.js";

test("/supplies unprefixed capture creates supply grammar", () => {
  assert.equal(applyModuleImpliedGrammar("/supplies", "gauze"), "$$ gauze");
  assert.equal(applyModuleImpliedGrammar("/supplies/active", "bandage"), "$$ bandage");
});

test("/supplies explicit grammar is preserved", () => {
  assert.equal(applyModuleImpliedGrammar("/supplies", "$$ gauze"), "$$ gauze");
  assert.equal(applyModuleImpliedGrammar("/supplies", "-- call vendor"), "-- call vendor");
});

test("/notes unprefixed capture creates note raw grammar with typed text", () => {
  assert.equal(
    applyModuleImpliedGrammar("/notes", "Clinic idea\nRemember supply bins"),
    ":::\ntitle: Clinic idea\ntags:\nlink:\n:::\nRemember supply bins",
  );
});

test("/notes explicit note grammar is preserved", () => {
  const raw = ":::\ntitle: Existing\ntags:\nlink:\n:::\nBody";
  assert.equal(applyModuleImpliedGrammar("/notes", raw), raw);
});

test("/files requires attachment and implies file grammar when attached", () => {
  assert.deepEqual(moduleCaptureBehaviorFromPathname("/files"), {
    kind: "file",
    prefix: "++",
    requiresAttachedFile: true,
  });
  assert.deepEqual(moduleCaptureBehaviorFromPathname("/files/archive"), {
    kind: "file",
    prefix: "++",
    requiresAttachedFile: true,
  });
  assert.equal(applyModuleImpliedGrammar("/files", "lab report"), "lab report");
  assert.equal(
    applyModuleImpliedGrammar("/files", "lab report", { hasAttachedFile: true }),
    "++ lab report",
  );
});

test("/fax requires attachment and implies fax grammar when attached", () => {
  assert.deepEqual(moduleCaptureBehaviorFromPathname("/fax"), {
    kind: "fax",
    prefix: "fax:",
    requiresAttachedFile: true,
  });
  assert.deepEqual(moduleCaptureBehaviorFromPathname("/fax/outbox"), {
    kind: "fax",
    prefix: "fax:",
    requiresAttachedFile: true,
  });
  assert.equal(applyModuleImpliedGrammar("/fax", "021234567"), "021234567");
  assert.equal(
    applyModuleImpliedGrammar("/fax", "021234567", { hasAttachedFile: true }),
    "fax:021234567",
  );
});

test("/tasks unprefixed capture creates task grammar", () => {
  assert.equal(
    applyModuleImpliedGrammar("/tasks", "Pay rent\nd:2026-06-01 10:30\nR:monthly\n#home"),
    "-- Pay rent\nd:2026-06-01 10:30\nR:monthly\n#home",
  );
});

test("/events unprefixed capture creates event grammar", () => {
  assert.equal(
    applyModuleImpliedGrammar("/events", "Mom birthday\nd:2026-08-14\n#family"),
    "^^ 2026-08-14 Mom birthday\n#family",
  );
});

test("/reminders unprefixed capture creates reminder grammar", () => {
  assert.equal(
    applyModuleImpliedGrammar("/reminders", "2026-06-01 09:00\nCall pharmacy\n#clinic"),
    "!! 2026-06-01 09:00\nCall pharmacy\n#clinic",
  );
});

test("/journal and /journals unprefixed capture creates journal grammar", () => {
  const raw = "Long clinic day. Felt exhausted.\n#clinic";
  const expected = "// Long clinic day. Felt exhausted.\n#clinic";
  assert.equal(applyModuleImpliedGrammar("/journal", raw), expected);
  assert.equal(applyModuleImpliedGrammar("/journals", raw), expected);
});

test("/scribble unprefixed capture creates scribble grammar", () => {
  assert.equal(
    applyModuleImpliedGrammar("/scribble", "Need to figure out insurance thing\n#insurance"),
    "... Need to figure out insurance thing\n#insurance",
  );
});

test("global unprefixed capture remains unchanged", () => {
  assert.equal(applyModuleImpliedGrammar("/", "Pay rent"), "Pay rent");
  assert.equal(applyModuleImpliedGrammar("/capture", "Pay rent"), "Pay rent");
});

test("implied capture does not run during edit mode", () => {
  assert.equal(
    applyModuleImpliedGrammar("/tasks", "Pay rent", { isEditing: true }),
    "Pay rent",
  );
});

test("attached file still prevents non-file module implied grammar", () => {
  assert.equal(
    applyModuleImpliedGrammar("/tasks", "Pay rent", { hasAttachedFile: true }),
    "Pay rent",
  );
});

test("explicit prefixes always win across module pages", () => {
  const explicit = [
    "-- task",
    "^^ 2026-06-01 event",
    "!! 2026-06-01 09:00 reminder",
    "// journal",
    "... scribble",
    "$$ supply",
    ":::\ntitle: Note\ntags:\nlink:\n:::\nBody",
    "++ file",
    "fax:021234567",
  ];
  for (const raw of explicit) {
    assert.equal(applyModuleImpliedGrammar("/supplies", raw), raw);
    assert.equal(applyModuleImpliedGrammar("/tasks", raw), raw);
    assert.equal(applyModuleImpliedGrammar("/notes", raw), raw);
  }
});
