"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /chill — legacy route. Casual rooms now live on the main screen
 * (первая вкладка «Общение»). Redirect keeps old deep links working.
 */
export default function ChillPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/?section=casual");
  }, [router]);
  return (
    <main className="min-h-screen flex flex-col items-center justify-center">
      <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
    </main>
  );
}
