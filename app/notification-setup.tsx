"use client";
import { useEffect } from "react";
import { setupForegroundNotifications, registerPushToken } from "@/lib/notifications";

export default function NotificationSetup() {
  useEffect(() => {
    setupForegroundNotifications();

    // Re-register token on focus so stale tokens get refreshed
    const onFocus = () => {
      const playerId = localStorage.getItem("playerId");
      const roomCode = localStorage.getItem("roomCode");
      if (playerId && roomCode) {
        registerPushToken(roomCode, playerId).catch(() => {});
      }
    };

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return null;
}
