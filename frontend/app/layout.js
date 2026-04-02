export const metadata = {
  title: "KaosGdd Web",
  description: "Tailscale-only web UI for KaosGdd"
};

import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
