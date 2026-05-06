import { useEffect } from "react";
import { sessionStore } from "../stores/sessionStore";

export function useSessionBootstrap() {
  useEffect(() => {
    void sessionStore.bootstrap();
  }, []);

  return sessionStore.useStore((state) => state);
}
