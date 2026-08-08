import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Konios Portfolio Admin",
  description: "Secure property operations and guest-access dashboard.",
  icons: { icon: "/admin-portal-icon.svg", shortcut: "/admin-portal-icon.svg", apple: "/admin-portal-icon.svg" },
};

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
