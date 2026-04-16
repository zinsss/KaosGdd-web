import { UI_STRINGS } from "../lib/strings";

export default function manifest() {
  return {
    name: UI_STRINGS.APP_TITLE_WEB,
    short_name: UI_STRINGS.APP_TITLE,
    description: UI_STRINGS.APP_DESCRIPTION,
    start_url: "/tasks",
    scope: "/",
    display: "standalone",
    background_color: "#121212",
    theme_color: "#121212",
  };
}
