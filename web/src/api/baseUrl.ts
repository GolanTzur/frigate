declare global {
  interface Window {
    baseUrl?: string;
  }
}

export const baseUrl = window.location.origin + "/";