import { apiFetch } from './apiClient';

export type MetodoPagoBackend = 'TARJETA' | 'TRANSFERENCIA' | 'EFECTIVO' | 'WEBPAY';
export type EstadoPagoBackend = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

export interface CrearPagoPayload {
  pedidoId: number;
  monto: number;
  metodoPago: MetodoPagoBackend;
}

export interface PagoBackendResponse {
  id: number;
  pedidoId: number;
  monto: number;
  metodoPago: MetodoPagoBackend;
  estado: EstadoPagoBackend;
  fechaPago: string;
  activo: boolean;
}

export const crearPagoApi = (payload: CrearPagoPayload): Promise<PagoBackendResponse> => (
  apiFetch<PagoBackendResponse>('/mangas/pagos', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
);

export const aprobarPagoApi = (id: number): Promise<PagoBackendResponse> => (
  apiFetch<PagoBackendResponse>(`/mangas/pagos/${id}/aprobar`, {
    method: 'PUT',
  })
);

export const rechazarPagoApi = (id: number): Promise<PagoBackendResponse> => (
  apiFetch<PagoBackendResponse>(`/mangas/pagos/${id}/rechazar`, {
    method: 'PUT',
  })
);

export const obtenerPagosPorPedidoApi = (pedidoId: number): Promise<PagoBackendResponse[]> => (
  apiFetch<PagoBackendResponse[]>(`/mangas/pagos/pedido/${pedidoId}`)
);

export const obtenerTodosPagosApi = (): Promise<PagoBackendResponse[]> => (
  apiFetch<PagoBackendResponse[]>('/mangas/pagos')
);