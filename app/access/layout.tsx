import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Konios Guest Portal",
  description: "Your private apartment guide and stay information.",
  icons: { icon: "/guest-portal-icon.svg", shortcut: "/guest-portal-icon.svg", apple: "/guest-portal-icon.svg" },
};

export default function AccessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
