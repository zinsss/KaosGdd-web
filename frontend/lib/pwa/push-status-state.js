function formatLastTestSummary(lastTest) {
  if (!lastTest) return "No backend test sent yet";
  const when = lastTest.last_test_at ? new Date(lastTest.last_test_at).toLocaleString() : "unknown time";
  if (lastTest.ok) {
    return `Last test at ${when}: success (${lastTest.sent} sent)`;
  }
  const firstError = lastTest.first_error_summary ? ` • ${lastTest.first_error_summary}` : "";
  return `Last test at ${when}: failed (${lastTest.sent} sent, ${lastTest.removed} removed)${firstError}`;
}

export function describeEnabledPushState(backendStatus) {
  if (!backendStatus.backend_subscription_saved || backendStatus.endpoint_match === false) {
    return {
      message: "Notifications enabled locally, but backend subscription is missing",
      backendConnected: false,
      deliveryStatus: formatLastTestSummary(backendStatus.last_test || null),
    };
  }
  if (backendStatus.last_test && backendStatus.last_test.ok === false) {
    return {
      message: "Notifications enabled, but last backend test push failed",
      backendConnected: true,
      deliveryStatus: formatLastTestSummary(backendStatus.last_test),
    };
  }
  return {
    message: "Notifications enabled and backend connected",
    backendConnected: true,
    deliveryStatus: formatLastTestSummary(backendStatus.last_test || null),
  };
}
