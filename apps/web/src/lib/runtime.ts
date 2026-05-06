declare global {
  interface Window {
    electronApp?: {
      readonly isDesktop: boolean;
      readonly apiBaseUrl: string;
    };
  }
}

export function resolveApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const desktopBaseUrl = window.electronApp?.apiBaseUrl?.trim();
    if (desktopBaseUrl) {
      return desktopBaseUrl.replace(/\/$/, "");
    }
  }

  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, "");
  }

  return "http://127.0.0.1:4000";
}
