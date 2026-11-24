import { PRECIO_MANGA_DIGITAL, type MangaCatalogo } from '../data/catalogo';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8090';
const BASE_CATALOGO = `${API_URL}/mangas/catalogo`;

interface MangaBackend {
  id: number;
  titulo: string;
  autor: string;
  editorial: string;
  genero: string;
  demografia: string;
  sinopsis?: string;
  numeroTomo: number;
  precioFisico: number;
  precioDigital: number;
  formato: 'FISICO' | 'DIGITAL' | 'FISICO_Y_DIGITAL';
  activo: boolean;
  imagen?: string;
  stock?: number;
  proximamenteFisico?: boolean;
}

const mapDesdeBackend = (item: MangaBackend): MangaCatalogo => {
  const esDigitalOnly = item.formato === 'DIGITAL';
  return {
    id: item.id,
    titulo: item.titulo,
    precio: esDigitalOnly ? (item.precioDigital || PRECIO_MANGA_DIGITAL) : item.precioFisico,
    precioDigital: item.precioDigital || PRECIO_MANGA_DIGITAL,
    demografia: item.demografia,
    generos: item.genero ? item.genero.split(',').map(g => g.trim()).filter(Boolean) : ['Acción'],
    esDigitalOnly,
    proximamenteFisico: Boolean(item.proximamenteFisico),
    imagen: item.imagen || '/images/logo/logoMangaFlow.png',
    autor: item.autor,
    sinopsis: item.sinopsis,
    tomosDisponibles: item.numeroTomo || 1,
    activo: item.activo,
    stock: item.stock ?? 0,
  };
};

const mapHaciaBackend = (manga: Omit<MangaCatalogo, 'id'> & { editorial?: string }) => ({
  titulo: manga.titulo,
  autor: manga.autor?.trim() || 'Autor por confirmar',
  editorial: manga.editorial?.trim() || 'MangaFlow Editorial',
  genero: manga.generos.join(', ') || 'Acción',
  demografia: manga.demografia,
  sinopsis: manga.sinopsis || '',
  numeroTomo: manga.tomosDisponibles ?? 1,
  precioFisico: manga.esDigitalOnly ? 8990 : Math.max(1, manga.precio),
  precioDigital: manga.precioDigital ?? PRECIO_MANGA_DIGITAL,
  formato: manga.esDigitalOnly ? 'DIGITAL' : 'FISICO_Y_DIGITAL',
  imagen: manga.imagen || '/images/logo/logoMangaFlow.png',
  stock: manga.stock ?? 0,
  proximamenteFisico: Boolean(manga.proximamenteFisico),
});

const extraerError = async (respuesta: Response, respaldo: string): Promise<string> => {
  try {
    const data = await respuesta.json();
    if (Array.isArray(data.details) && data.details.length > 0) return data.details.join(' · ');
    if (typeof data.message === 'string' && data.message) return data.message;
  } catch {
    // Ignorar error de parseo
  }
  return respaldo;
};

export const obtenerCatalogoApi = async (): Promise<MangaCatalogo[]> => {
  const respuesta = await fetch(BASE_CATALOGO);
  if (!respuesta.ok) throw new Error(await extraerError(respuesta, 'No se pudo cargar el catálogo'));
  const datos: MangaBackend[] = await respuesta.json();
  return datos.map(mapDesdeBackend);
};

export const crearMangaApi = async (manga: Omit<MangaCatalogo, 'id'>): Promise<MangaCatalogo> => {
  const respuesta = await fetch(BASE_CATALOGO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mapHaciaBackend(manga)),
  });
  if (!respuesta.ok) throw new Error(await extraerError(respuesta, 'Error al crear el manga'));
  return mapDesdeBackend(await respuesta.json());
};

export const actualizarMangaApi = async (manga: MangaCatalogo): Promise<MangaCatalogo> => {
  const respuesta = await fetch(`${BASE_CATALOGO}/${manga.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mapHaciaBackend(manga)),
  });
  if (!respuesta.ok) throw new Error(await extraerError(respuesta, 'Error al actualizar el manga'));
  return mapDesdeBackend(await respuesta.json());
};

export const cambiarEstadoMangaApi = async (id: number, activar: boolean): Promise<MangaCatalogo> => {
  const accion = activar ? 'activar' : 'desactivar';
  const respuesta = await fetch(`${BASE_CATALOGO}/${id}/${accion}`, { method: 'PUT' });
  if (!respuesta.ok) throw new Error(await extraerError(respuesta, 'Error al cambiar estado del manga'));
  return mapDesdeBackend(await respuesta.json());
};

export const eliminarMangaApi = async (id: number): Promise<void> => {
  const respuesta = await fetch(`${BASE_CATALOGO}/${id}`, { method: 'DELETE' });
  if (!respuesta.ok) throw new Error(await extraerError(respuesta, 'Error al eliminar el manga'));
};