"use client";

import { AppShell } from "@/components/AppShell";
import { OtherUserProfile } from "@/components/profile/OtherUserProfile";
import { useUser } from "@/lib/UserContext";

export default function UserProfilePage() {
  const { user, loading } = useUser();

  if (loading && !user) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </main>
    );
  }
  if (!user) return null;

  return (
    <AppShell user={user}>
      <OtherUserProfile currentUser={user} />
    </AppShell>
  );
}
