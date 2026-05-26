import { UI_STRINGS } from "../strings.js";

export async function sendPushoverTest() {
  let res;
  let data;
  try {
    res = await fetch("/api/push/pushover-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    data = await res.json();
  } catch {
    throw new Error(UI_STRINGS.PUSHOVER_TEST_REQUEST_FAILED);
  }

  if (!res.ok || !data) {
    throw new Error(data?.error || UI_STRINGS.PUSHOVER_TEST_REQUEST_FAILED);
  }
  if (!data.ok) {
    const reason = data?.reason ? ` (${data.reason})` : "";
    throw new Error(`${UI_STRINGS.PUSHOVER_TEST_FAILED}${reason}`);
  }
  return data;
}
