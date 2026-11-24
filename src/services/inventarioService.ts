import { obtenerTokenGuardado } from './apiClient';

const INVENTARIO_API_URL = import.meta.env.VITE_INVENTARIO_API_URL ?? 'http://localhost:8084/mangas/inventario';

export interface InventarioBackendResponse {
  id: number;
  mangaId: number;
  stock: number;
  stockMinimo: number;
  activo: boolean;
}

const headersInventario = (conJson = false): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (conJson) headers['Content-Type'] = 'application/json';
  const token = obtenerTokenGuardado();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const leerErrorApi = async (respuesta: Response, fallback: string): Promise<string> => {
  try {
    const cuerpo = await respuesta.json();
    if (typeof cuerpo?.message === 'string') return cuerpo.message;
    if (typeof cuerpo?.error === 'string') return cuerpo.error;
  } catch {
    const texto = await respuesta.text().catch(() => '');
    if (texto) return texto;
  }
  return fallback;
};

export const obtenerInventariosApi = async (): Promise<InventarioBackendResponse[]> => {
  const respuesta = await fetch(INVENTARIO_API_URL, {
    headers: headersInventario(false),
  });
  if (!respuesta.ok) {
    throw new Error(await leerErrorApi(respuesta, `Error ${respuesta.status} al cargar el inventario.`));
  }
  return respuesta.json() as Promise<InventarioBackendResponse[]>;
};

export const sincronizarStockMangaApi = async (
  mangaId: number,
  nuevoStock: number,
  stockMinimo = 5,
): Promise<InventarioBackendResponse> => {
  const stockObjetivo = Math.max(0, Math.floor(nuevoStock));
  const consulta = await fetch(`${INVENTARIO_API_URL}/manga/${mangaId}`, {
    headers: headersInventario(false),
  });

  if (consulta.status === 404) {
    const creacion = await fetch(INVENTARIO_API_URL, {
      method: 'POST',
      headers: headersInventario(true),
      body: JSON.stringify({
        mangaId,
        stock: stockObjetivo,
        stockMinimo,
      }),
    });
    if (!creacion.ok) {
      throw new Error(await leerErrorApi(creacion, 'No se pudo inicializar el stock en inventario-service.'));
    }
    return creacion.json() as Promise<InventarioBackendResponse>;
  }

  if (!consulta.ok) {
    throw new Error(await leerErrorApi(consulta, 'No se pudo consultar el stock actual del manga.'));
  }

  const actual = await consulta.json() as InventarioBackendResponse;
  const diferencia = stockObjetivo - actual.stock;

  if (diferencia === 0) return actual;

  const endpoint = diferencia > 0
    ? `${INVENTARIO_API_URL}/agregar/${mangaId}/${diferencia}`
    : `${INVENTARIO_API_URL}/descontar/${mangaId}/${Math.abs(diferencia)}`;

  const actualizacion = await fetch(endpoint, {
    method: 'POST',
    headers: headersInventario(false),
  });
  if (!actualizacion.ok) {
    throw new Error(await leerErrorApi(actualizacion, 'No se pudo actualizar el stock en inventario-service.'));
  }
  return actualizacion.json() as Promise<InventarioBackendResponse>;
};