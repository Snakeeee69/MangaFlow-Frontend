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

export const crearPedidoApi = async (
  payload: CrearPedidoPayload,
  token?: string,
): Promise<PedidoBackendResponse> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const respuesta = await fetch(PEDIDOS_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!respuesta.ok) {
    let detalle = `Error ${respuesta.status} al registrar el pedido.`;
    try {
      const cuerpo = await respuesta.json();
      if (typeof cuerpo?.error === 'string') {
        detalle = cuerpo.error;
      } else if (typeof cuerpo === 'object' && cuerpo !== null) {
        const mensajes = Object.values(cuerpo).filter((v): v is string => typeof v === 'string');
        if (mensajes.length > 0) detalle = mensajes.join(' · ');
      }
    } catch {
      const texto = await respuesta.text().catch(() => '');
      if (texto) detalle = texto;
    }
    throw new Error(detalle);
  }

  return respuesta.json() as Promise<PedidoBackendResponse>;
};