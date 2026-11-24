import { obtenerTokenGuardado } from './apiClient';

const PEDIDOS_API_URL = import.meta.env.VITE_PEDIDOS_API_URL ?? 'http://localhost:8085/mangas/pedidos';

export interface CrearPedidoPayload {
  personaId: number;
  mangaId: number;
  cantidad: number;
  precioUnitario: number;
}

export interface PedidoBackendResponse {
  id: number;
  personaId: number;
  mangaId: number;
  cantidad: number;
  precioUnitario: number;
  total: number;
  estado: 'PENDIENTE' | 'CONFIRMADO' | 'CANCELADO';
  fechaCreacion: string;
  activo: boolean;
}

const headersPedidos = (conJson = false, tokenExplicit?: string): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (conJson) headers['Content-Type'] = 'application/json';
  const token = tokenExplicit || obtenerTokenGuardado();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const leerErrorPedido = async (respuesta: Response, fallback: string): Promise<string> => {
  try {
    const cuerpo = await respuesta.json();
    if (typeof cuerpo?.error === 'string') return cuerpo.error;
    if (typeof cuerpo === 'object' && cuerpo !== null) {
      const mensajes = Object.values(cuerpo).filter((v): v is string => typeof v === 'string');
      if (mensajes.length > 0) return mensajes.join(' · ');
    }
  } catch {
    const texto = await respuesta.text().catch(() => '');
    if (texto) return texto;
  }
  return fallback;
};

export const crearPedidoApi = async (
  payload: CrearPedidoPayload,
  token?: string,
): Promise<PedidoBackendResponse> => {
  const respuesta = await fetch(PEDIDOS_API_URL, {
    method: 'POST',
    headers: headersPedidos(true, token),
    body: JSON.stringify(payload),
  });

  if (!respuesta.ok) {
    throw new Error(await leerErrorPedido(respuesta, `Error ${respuesta.status} al registrar el pedido.`));
  }
  return respuesta.json() as Promise<PedidoBackendResponse>;
};

export const obtenerPedidosPorPersonaApi = async (personaId: number): Promise<PedidoBackendResponse[]> => {
  const respuesta = await fetch(`${PEDIDOS_API_URL}/persona/${personaId}`, {
    headers: headersPedidos(false),
  });
  if (!respuesta.ok) {
    throw new Error(await leerErrorPedido(respuesta, `Error ${respuesta.status} al cargar tus pedidos.`));
  }
  return respuesta.json() as Promise<PedidoBackendResponse[]>;
};

export const obtenerTodosPedidosApi = async (): Promise<PedidoBackendResponse[]> => {
  const respuesta = await fetch(PEDIDOS_API_URL, {
    headers: headersPedidos(false),
  });
  if (!respuesta.ok) {
    throw new Error(await leerErrorPedido(respuesta, `Error ${respuesta.status} al cargar los pedidos.`));
  }
  return respuesta.json() as Promise<PedidoBackendResponse[]>;
};

export const confirmarPedidoApi = async (id: number): Promise<PedidoBackendResponse> => {
  const respuesta = await fetch(`${PEDIDOS_API_URL}/${id}/confirmar`, {
    method: 'PUT',
    headers: headersPedidos(false),
  });
  if (!respuesta.ok) {
    throw new Error(await leerErrorPedido(respuesta, 'No se pudo confirmar el pedido.'));
  }
  return respuesta.json() as Promise<PedidoBackendResponse>;
};

export const cancelarPedidoApi = async (id: number): Promise<PedidoBackendResponse> => {
  const respuesta = await fetch(`${PEDIDOS_API_URL}/${id}/cancelar`, {
    method: 'PUT',
    headers: headersPedidos(false),
  });
  if (!respuesta.ok) {
    throw new Error(await leerErrorPedido(respuesta, 'No se pudo cancelar el pedido.'));
  }
  return respuesta.json() as Promise<PedidoBackendResponse>;
};