export default function manifest() {
  return {
    name: "KaosGdd Web",
    short_name: "KaosGdd",
    description: "Tailscale-only web UI for KaosGdd",
    start_url: "/tasks",
    scope: "/",
    display: "standalone",
    background_color: "#121212",
    theme_color: "#121212",
  };
}
