const configuredApiUrl = (import.meta as ImportMeta & {
  env?: { VITE_API_URL?: string };
}).env?.VITE_API_URL;

const apiBaseUrl = configuredApiUrl?.replace(/\/+$/, '') ?? '';

export function apiUrl(path: string): string {
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
