import { cargarSesion } from '../data/sesion';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8090';

export type TipoDescuentoBackend = 'DIGITAL_A_FISICO' | 'PROMOCION' | 'PREVENTA' | 'NINGUNO';

export interface DescuentoResponse {
  id: number;
  personaId: number;
  mangaId: number;
  precioOriginal: number;
  porcentajeDescuento: number;
  montoDescuento: number;
  precioFinal: number;
  tipoDescuento: TipoDescuentoBackend;
  motivo: string;
  fechaCalculo: string;
  activo: boolean;
}

export interface CalcularDescuentoPayload {
  personaId: number;
  mangaId: number;
  precioOriginal: number;
  tipoDescuento: TipoDescuentoBackend;
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

export const listarDescuentosPorPersonaApi = async (personaId: number): Promise<DescuentoResponse[]> => {
  const res = await fetch(`${API_BASE_URL}/mangas/descuentos/persona/${personaId}`, {
    headers: headersConToken(),
  });
  if (res.status === 404) return [];
  return manejarRespuesta<DescuentoResponse[]>(res);
};

export const calcularDescuentoApi = async (
  payload: CalcularDescuentoPayload,
): Promise<DescuentoResponse> => {
  const res = await fetch(`${API_BASE_URL}/mangas/descuentos/calcular`, {
    method: 'POST',
    headers: headersConToken(),
    body: JSON.stringify(payload),
  });
  return manejarRespuesta<DescuentoResponse>(res);
};

export const desactivarDescuentoApi = async (id: number): Promise<void> => {
  const res = await fetch(`${API_BASE_URL}/mangas/descuentos/${id}`, {
    method: 'DELETE',
    headers: headersConToken(),
  });
  if (!res.ok && res.status !== 404) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || data?.message || `Error HTTP ${res.status}`);
  }
};