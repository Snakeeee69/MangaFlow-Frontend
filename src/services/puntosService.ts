import { cargarSesion } from '../data/sesion';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8090';

export interface CuentaPuntosResponse {
  id: number;
  personaId: number;
  saldo: number;
  fechaCreacion: string;
  activo: boolean;
}

export interface MovimientoPuntosResponse {
  id: number;
  personaId: number;
  pagoId: number | null;
  tipoMovimiento: 'GANANCIA_COMPRA' | 'CANJE_RECOMPENSA' | 'AJUSTE_ADMIN';
  puntos: number;
  descripcion: string;
  fechaMovimiento: string;
}

const headersConToken = (): HeadersInit => {
  const sesion = cargarSesion();
  return {
    'Content-Type': 'application/json',
    ...(sesion?.token ? { Authorization: `Bearer ${sesion.token}` } : {}),
  };
};

const manejarRespuesta = async <T>(res: Response): Promise<T> => {
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const mensaje = data?.error || data?.message || `Error HTTP ${res.status}`;
    throw new Error(mensaje);
  }
  return res.json() as Promise<T>;
};

export const obtenerCuentaPuntosApi = async (personaId: number): Promise<CuentaPuntosResponse | null> => {
  const res = await fetch(`${API_BASE_URL}/mangas/puntos/persona/${personaId}`, {
    headers: headersConToken(),
  });
  if (res.status === 404) return null;
  return manejarRespuesta<CuentaPuntosResponse>(res);
};

export const listarMovimientosPuntosApi = async (personaId: number): Promise<MovimientoPuntosResponse[]> => {
  const res = await fetch(`${API_BASE_URL}/mangas/puntos/movimientos/persona/${personaId}`, {
    headers: headersConToken(),
  });
  if (res.status === 404) return [];
  return manejarRespuesta<MovimientoPuntosResponse[]>(res);
};

export const acumularPuntosApi = async (personaId: number, pagoId: number): Promise<CuentaPuntosResponse> => {
  const res = await fetch(`${API_BASE_URL}/mangas/puntos/acumular`, {
    method: 'POST',
    headers: headersConToken(),
    body: JSON.stringify({ personaId, pagoId }),
  });
  return manejarRespuesta<CuentaPuntosResponse>(res);
};

export const acreditarPuntosApi = async (
  personaId: number,
  puntos: number,
  descripcion: string,
): Promise<CuentaPuntosResponse> => {
  const res = await fetch(`${API_BASE_URL}/mangas/puntos/acreditar`, {
    method: 'POST',
    headers: headersConToken(),
    body: JSON.stringify({ personaId, puntos, descripcion }),
  });
  return manejarRespuesta<CuentaPuntosResponse>(res);
};

export const canjearPuntosApi = async (
  personaId: number,
  puntos: number,
  descripcion: string,
): Promise<CuentaPuntosResponse> => {
  const res = await fetch(`${API_BASE_URL}/mangas/puntos/canjear`, {
    method: 'POST',
    headers: headersConToken(),
    body: JSON.stringify({ personaId, puntos, descripcion }),
  });
  return manejarRespuesta<CuentaPuntosResponse>(res);
};