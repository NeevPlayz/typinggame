"use client";
export const dynamic = "force-dynamic";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sendMessage } from "@/lib/firestore";

export default function SharePage() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const title = params.get("title") || "";
    const text = params.get("text") || "";
    const url = params.get("url") || "";

    // Build the message: prefer url, fallback to text, then title
    const shared = url || text || title;

    const playerId = localStorage.getItem("playerId");
    const playerName = localStorage.getItem("playerName") || "";
    const roomCode = localStorage.getItem("roomCode");

    if (!playerId || !roomCode) {
      // Not logged in — go to settings, shared content lost (rare case)
      router.replace("/settings");
      return;
    }

    if (shared) {
      sendMessage(roomCode, shared, playerId, playerName)
        .catch(() => {})
        .finally(() => {
          router.replace(`/chat/${roomCode}`);
        });
    } else {
      router.replace(`/chat/${roomCode}`);
    }
  }, [params, router]);

  return (
    <div className="h-dvh flex items-center justify-center" style={{ background: "#07000f" }}>
      <div className="text-center">
        <div className="text-3xl mb-3">🎮</div>
        <div className="text-xs tracking-widest" style={{ color: "#4a5568" }}>SENDING TO CHAT...</div>
      </div>
    </div>
  );
}
