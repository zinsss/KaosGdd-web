import { UI_STRINGS } from "../lib/strings";

export default function manifest() {
  return {
    name: UI_STRINGS.APP_TITLE_WEB,
    short_name: UI_STRINGS.APP_TITLE,
    description: UI_STRINGS.APP_DESCRIPTION,
    start_url: "/tasks",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#121212",
    theme_color: "#121212",
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [
          {
            name: "files",
            accept: ["*/*"],
          },
        ],
      },
    },
  };
}
