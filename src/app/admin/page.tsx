import type { Metadata } from "next";
import { AdminPanel } from "./AdminPanel";

export const metadata: Metadata = {
  title: "VoiceDeck Admin",
  description: "Панель управления VoiceDeck",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminPanel />;
}
