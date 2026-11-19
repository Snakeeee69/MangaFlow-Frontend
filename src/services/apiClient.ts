const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8090';

export const obtenerTokenGuardado = (): string | null => {
  try {
    const raw = localStorage.getItem('mangaFlow_session');
    if (!raw) return null;
    const sesion = JSON.parse(raw) as { token?: string; isGuest?: boolean };
    if (sesion.isGuest || !sesion.token) return null;
    return sesion.token;
  } catch {
    return null;
  }
};

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = obtenerTokenGuardado();
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let mensajeError = `Error HTTP ${response.status}`;
    try {
      const data = await response.json() as { message?: string; error?: string };
      mensajeError = data.message || data.error || mensajeError;
    } catch {
      // Si no viene JSON, usamos el mensaje por defecto
    }
    throw new Error(mensajeError);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}