import test from "node:test";
import { readdir } from "node:fs/promises";

test("diagnostic frontend test file list", async () => {
  const files = await readdir(new URL(".", import.meta.url));
  console.log(`# frontend test files: ${files.filter((file) => file.endsWith(".test.js")).join(", ")}`);
});
