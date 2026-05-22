import test from "node:test";
import assert from "node:assert/strict";

import { applyModuleImpliedGrammar } from "../lib/module-implied-capture.js";

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

test("/journal unprefixed capture creates journal grammar", () => {
  assert.equal(
    applyModuleImpliedGrammar("/journal", "Long clinic day. Felt exhausted.\n#clinic"),
    "// Long clinic day. Felt exhausted.\n#clinic",
  );
});

test("/scribble unprefixed capture creates scribble grammar", () => {
  assert.equal(
    applyModuleImpliedGrammar("/scribble", "Need to figure out insurance thing\n#insurance"),
    "... Need to figure out insurance thing\n#insurance",
  );
});

test("explicit prefix inside module overrides implied type", () => {
  assert.equal(applyModuleImpliedGrammar("/journal", "-- Pay rent"), "-- Pay rent");
  assert.equal(applyModuleImpliedGrammar("/tasks", "// Felt tired"), "// Felt tired");
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

test("implied capture does not run with attached file", () => {
  assert.equal(
    applyModuleImpliedGrammar("/tasks", "Pay rent", { hasAttachedFile: true }),
    "Pay rent",
  );
});
