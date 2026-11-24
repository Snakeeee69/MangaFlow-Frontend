import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  cargarMetricasAdmin,
  suscribirMetricasAdmin,
  type DiaMetricas,
  type MetricasAdmin,
} from '../data/metricasAdmin';
import {
  demografiasCatalogo,
  esMangaActivo,
  generosCatalogo,
  PRECIO_MANGA_DIGITAL,
  type MangaCatalogo,
} from '../data/catalogo';
import type { RolMangaFlow } from '../data/sesion';
import {
  actualizarMangaApi,
  cambiarEstadoMangaApi,
  crearMangaApi,
  eliminarMangaApi,
} from '../services/catalogoService';
import {
  obtenerInventariosApi,
  sincronizarStockMangaApi,
} from '../services/inventarioService';
import {
  cancelarPedidoApi,
  confirmarPedidoApi,
  obtenerTodosPedidosApi,
  type PedidoBackendResponse,
} from '../services/pedidosService';

interface AdminProps {
  mangas: MangaCatalogo[];
  alGuardarCatalogo: (catalogo: MangaCatalogo[]) => void;
  rol: Extract<RolMangaFlow, 'admin' | 'staff'>;
}

interface FormularioManga {
  titulo: string;
  autor: string;
  precio: string;
  demografia: string;
  genero: string;
  imagen: string;
  sinopsis: string;
  stock: string;
  digital: boolean;
}

const formularioInicial: FormularioManga = {
  titulo: '',
  autor: '',
  precio: '',
  demografia: 'Shōnen',
  genero: 'Acción',
  imagen: '',
  sinopsis: '',
  stock: '10',
  digital: false,
};

const formatearCLP = (valor: number) => `$${Math.round(valor).toLocaleString('es-CL')}`;

const badgeEstadoPedido = (estado: PedidoBackendResponse['estado']) => {
  if (estado === 'CONFIRMADO') return 'bg-success';
  if (estado === 'CANCELADO') return 'bg-danger';
  return 'bg-warning text-dark';
};

const GraficoVentas = ({ dias }: { dias: DiaMetricas[] }) => {
  const valorMaximo = Math.max(1, ...dias.map(dia => dia.ventas));

  return (
    <section className="admin-chart-panel p-3 p-md-4 rounded-4 h-100" aria-labelledby="admin-chart-sales-title">
      <div className="mb-3">
        <h2 id="admin-chart-sales-title" className="text-white fw-bold fs-5 mb-1">Ventas por día</h2>
        <p className="text-secondary small mb-0">Ingresos registrados en los últimos 7 días</p>
      </div>
      <div className="admin-chart-bars" role="img" aria-label={`Ventas por día: ${dias.map(dia => `${dia.etiqueta} ${formatearCLP(dia.ventas)}`).join(', ')}`}>
        {dias.map(dia => (
          <div className="admin-chart-day" key={dia.clave} title={`${dia.etiqueta}: ${formatearCLP(dia.ventas)}`}>
            <span className="admin-chart-value">{dia.ventas > 0 ? formatearCLP(dia.ventas) : ''}</span>
            <div className="admin-chart-track">
              <span
                className="admin-chart-bar sales"
                style={{ height: `${dia.ventas > 0 ? Math.max(5, dia.ventas / valorMaximo * 112) : 0}px` }}
              />
            </div>
            <span className="admin-chart-label">{dia.etiqueta}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

const GraficoActividad = ({ dias }: { dias: DiaMetricas[] }) => {
  const valorMaximo = Math.max(1, ...dias.flatMap(dia => [dia.visitas, dia.registros, dia.compras]));
  const series = [
    { clave: 'visitas', etiqueta: 'Visitas', clase: 'visits' },
    { clave: 'registros', etiqueta: 'Registros', clase: 'registrations' },
    { clave: 'compras', etiqueta: 'Compras', clase: 'purchases' },
  ] as const;

  return (
    <section className="admin-chart-panel p-3 p-md-4 rounded-4 h-100" aria-labelledby="admin-chart-activity-title">
      <div className="mb-3">
        <h2 id="admin-chart-activity-title" className="text-white fw-bold fs-5 mb-1">Actividad diaria</h2>
        <p className="text-secondary small mb-0">Visitas, registros nuevos y compras</p>
      </div>
      <div className="admin-chart-bars" role="img" aria-label={`Actividad por día: ${dias.map(dia => `${dia.etiqueta}: ${dia.visitas} visitas, ${dia.registros} registros, ${dia.compras} compras`).join('; ')}`}>
        {dias.map(dia => (
          <div className="admin-chart-day" key={dia.clave}>
            <span className="admin-chart-value">
              {Math.max(dia.visitas, dia.registros, dia.compras) || ''}
            </span>
            <div className="admin-chart-track admin-chart-group">
              {series.map(serie => {
                const cantidad = dia[serie.clave];
                return (
                  <span
                    className={`admin-chart-bar ${serie.clase}`}
                    key={serie.clave}
                    title={`${serie.etiqueta}: ${cantidad}`}
                    style={{ height: `${cantidad > 0 ? Math.max(5, cantidad / valorMaximo * 112) : 0}px` }}
                  />
                );
              })}
            </div>
            <span className="admin-chart-label">{dia.etiqueta}</span>
          </div>
        ))}
      </div>
      <div className="admin-chart-legend">
        {series.map(serie => (
          <span key={serie.clave}>
            <i className={`admin-chart-dot ${serie.clase}`} aria-hidden="true" />
            {serie.etiqueta}
          </span>
        ))}
      </div>
    </section>
  );
};

export const Admin = ({ mangas, alGuardarCatalogo, rol }: AdminProps) => {
  const esAdministrador = rol === 'admin';
  const [busqueda, setBusqueda] = useState('');
  const [verArchivados, setVerArchivados] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [formulario, setFormulario] = useState(formularioInicial);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [metricas, setMetricas] = useState<MetricasAdmin>(cargarMetricasAdmin);
  const [pedidosBackend, setPedidosBackend] = useState<PedidoBackendResponse[]>([]);
  const [stockPorManga, setStockPorManga] = useState<Record<number, number>>({});
  const [stockMinimoPorManga, setStockMinimoPorManga] = useState<Record<number, number>>({});

  useEffect(() => suscribirMetricasAdmin(() => setMetricas(cargarMetricasAdmin())), []);

  useEffect(() => {
    let cancelado = false;

    obtenerInventariosApi()
      .then(lista => {
        if (cancelado) return;
        const mapaStock: Record<number, number> = {};
        const mapaMinimo: Record<number, number> = {};
        lista.forEach(inv => {
          mapaStock[inv.mangaId] = inv.stock;
          mapaMinimo[inv.mangaId] = inv.stockMinimo;
        });
        setStockPorManga(mapaStock);
        setStockMinimoPorManga(mapaMinimo);
      })
      .catch(err => console.warn('No se pudo cargar inventario-service:', err));

    obtenerTodosPedidosApi()
      .then(lista => {
        if (!cancelado) {
          setPedidosBackend(
            [...lista].sort((a, b) => Date.parse(b.fechaCreacion) - Date.parse(a.fechaCreacion)),
          );
        }
      })
      .catch(err => console.warn('No se pudieron cargar pedidos desde pedidos-service:', err));

    return () => {
      cancelado = true;
    };
  }, []);

  const mangasFiltrados = useMemo(() => mangas.filter(manga => {
    const texto = `${manga.titulo} ${manga.autor ?? ''}`.toLocaleLowerCase('es');
    const coincideBusqueda = texto.includes(busqueda.trim().toLocaleLowerCase('es'));
    return coincideBusqueda && (esAdministrador && verArchivados || esMangaActivo(manga));
  }), [busqueda, esAdministrador, mangas, verArchivados]);

  const visibles = mangas.filter(esMangaActivo).length;
  const archivados = mangas.length - visibles;

  const totalComprasDashboard = pedidosBackend.length > 0 ? pedidosBackend.length : metricas.compras;
  const totalVentasDashboard = pedidosBackend.length > 0
    ? pedidosBackend
      .filter(p => p.estado !== 'CANCELADO')
      .reduce((acc, p) => acc + p.total, 0)
    : metricas.ventas;

  const actualizarCampo = <K extends keyof FormularioManga>(campo: K, valor: FormularioManga[K]) => {
    setFormulario(actual => ({ ...actual, [campo]: valor }));
  };

  const guardarNuevoManga = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMensaje('');

    const titulo = formulario.titulo.trim();
    const precio = Number(formulario.precio);
    const stock = Number(formulario.stock);
    const rutaImagen = formulario.imagen.trim();

    if (!titulo || !Number.isFinite(precio) || precio <= 0 || !Number.isInteger(stock) || stock < 0) {
      setError('Completa un título, un precio mayor que cero y un stock entero igual o superior a cero.');
      return;
    }

    try {
      const creado = await crearMangaApi({
        titulo,
        precio,
        precioDigital: PRECIO_MANGA_DIGITAL,
        demografia: formulario.demografia,
        generos: [formulario.genero],
        esDigitalOnly: formulario.digital,
        imagen: rutaImagen || '/images/logo/logoMangaFlow.png',
        autor: formulario.autor.trim() || undefined,
        sinopsis: formulario.sinopsis.trim() || undefined,
        activo: true,
        stock,
      });

      const invCreado = await sincronizarStockMangaApi(creado.id, stock);
      setStockPorManga(prev => ({ ...prev, [creado.id]: invCreado.stock }));
      setStockMinimoPorManga(prev => ({ ...prev, [creado.id]: invCreado.stockMinimo }));

      alGuardarCatalogo([...mangas, { ...creado, stock: invCreado.stock }]);
      setFormulario(formularioInicial);
      setMostrarFormulario(false);
      setMensaje(`${creado.titulo} se guardó en MySQL con ${invCreado.stock} unidades en inventario.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el manga en el servidor.');
    }
  };

  const cambiarVisibilidad = async (manga: MangaCatalogo) => {
    if (!esAdministrador && !esMangaActivo(manga)) return;
    const activar = !esMangaActivo(manga);
    try {
      const actualizado = await cambiarEstadoMangaApi(manga.id, activar);
      alGuardarCatalogo(mangas.map(item => item.id === manga.id ? actualizado : item));
      setMensaje(activar ? `${manga.titulo} volvió a estar visible.` : `${manga.titulo} se archivó en la base de datos.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la visibilidad.');
    }
  };

  const actualizarStockLocal = (manga: MangaCatalogo, valor: string) => {
    if (!esMangaActivo(manga)) return;
    const stock = Number(valor);
    if (!Number.isInteger(stock) || stock < 0) return;
    setStockPorManga(prev => ({ ...prev, [manga.id]: stock }));
    alGuardarCatalogo(mangas.map(item => item.id === manga.id ? { ...item, stock } : item));
  };

  const guardarStockEnServidor = async (manga: MangaCatalogo) => {
    if (!esMangaActivo(manga)) return;
    const stockObjetivo = stockPorManga[manga.id] ?? manga.stock ?? 0;
    try {
      const invActualizado = await sincronizarStockMangaApi(manga.id, stockObjetivo);
      setStockPorManga(prev => ({ ...prev, [manga.id]: invActualizado.stock }));
      const actualizado = await actualizarMangaApi({ ...manga, stock: invActualizado.stock }).catch(() => ({
        ...manga,
        stock: invActualizado.stock,
      }));
      alGuardarCatalogo(mangas.map(item => item.id === manga.id ? actualizado : item));
      setMensaje(`Stock de "${manga.titulo}" actualizado a ${invActualizado.stock} unidades en MySQL.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el stock en inventario.');
    }
  };

  const eliminarManga = async (manga: MangaCatalogo) => {
    if (!esAdministrador) return;
    if (!window.confirm(`¿Eliminar definitivamente "${manga.titulo}" de la base de datos?`)) return;
    try {
      await eliminarMangaApi(manga.id);
      alGuardarCatalogo(mangas.filter(item => item.id !== manga.id));
      setMensaje(`${manga.titulo} se eliminó definitivamente de MySQL.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el manga.');
    }
  };

  const cambiarEstadoPedido = async (pedidoId: number, accion: 'confirmar' | 'cancelar') => {
    setError('');
    try {
      const actualizado = accion === 'confirmar'
        ? await confirmarPedidoApi(pedidoId)
        : await cancelarPedidoApi(pedidoId);
      setPedidosBackend(prev => prev.map(p => p.id === pedidoId ? actualizado : p));
      setMensaje(`Pedido MF-${String(pedidoId).padStart(5, '0')} marcado como ${actualizado.estado}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado del pedido.');
    }
  };

  return (
    <main className="container admin-page py-4 py-lg-5">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <Link to="/inicio" className="admin-back-link">
            <i className="fa-solid fa-arrow-left me-2" aria-hidden="true" />
            Volver a MangaFlow
          </Link>
          <h1 className="text-white fw-bold fs-2 mt-3 mb-1">
            {esAdministrador ? 'Panel de administración' : 'Panel de personal'}
          </h1>
          <p className="text-secondary mb-0">
            {esAdministrador
              ? 'Gestiona el catálogo, el inventario en MySQL y los pedidos de MangaFlow.'
              : 'Agrega mangas, actualiza stock en inventario, archiva títulos y gestiona pedidos.'}
          </p>
        </div>
        <span className={`admin-role-badge ${esAdministrador ? '' : 'staff'}`}>
          <i className={`fa-solid ${esAdministrador ? 'fa-shield-halved' : 'fa-user-gear'} me-2`} aria-hidden="true" />
          {esAdministrador ? 'Administrador' : 'Personal'}
        </span>
      </div>

      {mensaje && (
        <div className="alert alert-success d-flex justify-content-between align-items-center" role="status">
          <span>{mensaje}</span>
          <button type="button" className="btn-close btn-close-white" aria-label="Cerrar aviso" onClick={() => setMensaje('')} />
        </div>
      )}
      {error && (
        <div className="alert alert-danger d-flex justify-content-between align-items-center" role="alert">
          <span>{error}</span>
          <button type="button" className="btn-close btn-close-white" aria-label="Cerrar aviso" onClick={() => setError('')} />
        </div>
      )}

      {esAdministrador && (
        <section className="row g-3 mb-4" aria-label="Resumen del catálogo">
          {[
            { etiqueta: 'Títulos visibles', valor: visibles, icono: 'fa-book-open' },
            { etiqueta: 'Archivados', valor: archivados, icono: 'fa-box-archive' },
            { etiqueta: 'Solo digital', valor: mangas.filter(manga => esMangaActivo(manga) && manga.esDigitalOnly).length, icono: 'fa-tablet-screen-button' },
          ].map(dato => (
            <div className="col-12 col-sm-4" key={dato.etiqueta}>
              <article className="admin-stat-card p-3 rounded-3 h-100">
                <div className="d-flex justify-content-between align-items-center">
                  <span className="text-secondary small">{dato.etiqueta}</span>
                  <i className={`fa-solid ${dato.icono} text-accent`} aria-hidden="true" />
                </div>
                <p className="text-white fs-3 fw-bold mb-0 mt-2">{dato.valor}</p>
              </article>
            </div>
          ))}
        </section>
      )}

      {esAdministrador && (
        <section className="mb-4" aria-label="Resumen de actividad y ventas">
          <h2 className="text-white fw-bold fs-5 mb-3">Resumen de la tienda</h2>
          <div className="row g-3 mb-3">
            {[
              { etiqueta: 'Visitas (7 días)', valor: metricas.dias.reduce((total, dia) => total + dia.visitas, 0), icono: 'fa-eye' },
              { etiqueta: 'Registros', valor: metricas.registros, icono: 'fa-user-plus' },
              { etiqueta: 'Pedidos', valor: totalComprasDashboard, icono: 'fa-bag-shopping' },
              { etiqueta: 'Ventas acumuladas', valor: formatearCLP(totalVentasDashboard), icono: 'fa-chart-line' },
              { etiqueta: 'Puntos utilizados', valor: metricas.puntosUsados.toLocaleString('es-CL'), icono: 'fa-star' },
            ].map(dato => (
              <div className="col-6 col-md-4 col-xl" key={dato.etiqueta}>
                <article className="admin-stat-card p-3 rounded-3 h-100">
                  <div className="d-flex justify-content-between align-items-center gap-2">
                    <span className="text-secondary small">{dato.etiqueta}</span>
                    <i className={`fa-solid ${dato.icono} text-accent`} aria-hidden="true" />
                  </div>
                  <p className="text-white fs-4 fw-bold mb-0 mt-2">{dato.valor}</p>
                </article>
              </div>
            ))}
          </div>
          <div className="row g-3">
            <div className="col-12 col-xl-5"><GraficoVentas dias={metricas.dias} /></div>
            <div className="col-12 col-xl-7"><GraficoActividad dias={metricas.dias} /></div>
          </div>
        </section>
      )}

      <section className="admin-catalog-panel p-3 p-md-4 rounded-4 mb-4" aria-labelledby="admin-orders-title">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h2 id="admin-orders-title" className="text-white fw-bold fs-5 mb-1">Pedidos (MySQL)</h2>
            <p className="text-secondary small mb-0">Órdenes registradas en pedidos-service.</p>
          </div>
          <span className="admin-role-badge">
            {pedidosBackend.length} {pedidosBackend.length === 1 ? 'pedido' : 'pedidos'}
          </span>
        </div>

        {pedidosBackend.length === 0 ? (
          <p className="text-secondary text-center py-4 mb-0">Todavía no hay pedidos registrados en la base de datos.</p>
        ) : (
          <div className="d-flex flex-column gap-2">
            {pedidosBackend.map(pedido => {
              const folio = `MF-${String(pedido.id).padStart(5, '0')}`;
              const manga = mangas.find(m => m.id === pedido.mangaId);

              return (
                <details className="admin-order-card p-3 rounded-3" key={pedido.id}>
                  <summary className="admin-order-summary">
                    <span className="min-w-0">
                      <strong className="text-white d-inline-block me-2">{folio}</strong>
                      <span className={`badge ${badgeEstadoPedido(pedido.estado)}`}>{pedido.estado}</span>
                      <span className="text-secondary small d-block">
                        Cliente ID #{pedido.personaId} · {manga?.titulo ?? `Manga #${pedido.mangaId}`} (×{pedido.cantidad})
                      </span>
                    </span>
                    <span className="text-secondary small text-nowrap">
                      {new Date(pedido.fechaCreacion).toLocaleDateString('es-CL')}
                    </span>
                    <strong className="text-white text-nowrap">{formatearCLP(pedido.total)}</strong>
                  </summary>
                  <div className="admin-order-details mt-3 pt-3 d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div className="text-secondary small">
                      <span>Precio unitario: <strong className="text-white">{formatearCLP(pedido.precioUnitario)}</strong></span>
                      <span className="mx-2">·</span>
                      <span>Cantidad: <strong className="text-white">{pedido.cantidad}</strong></span>
                    </div>
                    {pedido.estado === 'PENDIENTE' && (
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success"
                          onClick={() => cambiarEstadoPedido(pedido.id, 'confirmar')}
                        >
                          <i className="fa-solid fa-check me-1" aria-hidden="true" />
                          Confirmar
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => cambiarEstadoPedido(pedido.id, 'cancelar')}
                        >
                          <i className="fa-solid fa-xmark me-1" aria-hidden="true" />
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>

      <section className="admin-catalog-panel p-3 p-md-4 rounded-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
          <div>
            <h2 className="text-white fw-bold fs-5 mb-1">Catálogo e Inventario</h2>
            <p className="text-secondary small mb-0">Agrega títulos, ajusta stock en MySQL o archiva temporalmente.</p>
          </div>
          <button
            className="btn-magenta"
            type="button"
            onClick={() => {
              setMostrarFormulario(abierto => !abierto);
              setError('');
            }}
            aria-expanded={mostrarFormulario}
          >
            <i className={`fa-solid ${mostrarFormulario ? 'fa-xmark' : 'fa-plus'} me-2`} aria-hidden="true" />
            {mostrarFormulario ? 'Cerrar formulario' : 'Agregar manga'}
          </button>
        </div>

        {mostrarFormulario && (
          <form className="admin-add-form p-3 p-md-4 rounded-3 mb-4" onSubmit={guardarNuevoManga}>
            <h3 className="text-white fw-semibold fs-6 mb-3">Nuevo manga</h3>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label text-secondary small" htmlFor="admin-titulo">Título *</label>
                <input id="admin-titulo" className="form-control admin-input" value={formulario.titulo} onChange={event => actualizarCampo('titulo', event.target.value)} required maxLength={100} />
              </div>
              <div className="col-md-6">
                <label className="form-label text-secondary small" htmlFor="admin-autor">Autor</label>
                <input id="admin-autor" className="form-control admin-input" value={formulario.autor} onChange={event => actualizarCampo('autor', event.target.value)} maxLength={100} />
              </div>
              <div className="col-sm-6 col-md-3">
                <label className="form-label text-secondary small" htmlFor="admin-precio">Precio (CLP) *</label>
                <input id="admin-precio" className="form-control admin-input" type="number" min="1" step="1" value={formulario.precio} onChange={event => actualizarCampo('precio', event.target.value)} required />
              </div>
              <div className="col-sm-6 col-md-3">
                <label className="form-label text-secondary small" htmlFor="admin-stock">Stock inicial *</label>
                <input id="admin-stock" className="form-control admin-input" type="number" min="0" step="1" value={formulario.stock} onChange={event => actualizarCampo('stock', event.target.value)} required />
              </div>
              <div className="col-sm-6 col-md-3">
                <label className="form-label text-secondary small" htmlFor="admin-demografia">Demografía</label>
                <select id="admin-demografia" className="form-select admin-input" value={formulario.demografia} onChange={event => actualizarCampo('demografia', event.target.value)}>
                  {demografiasCatalogo.filter(opcion => opcion !== 'Todas').map(opcion => <option key={opcion}>{opcion}</option>)}
                </select>
              </div>
              <div className="col-sm-6 col-md-3">
                <label className="form-label text-secondary small" htmlFor="admin-genero">Género</label>
                <select id="admin-genero" className="form-select admin-input" value={formulario.genero} onChange={event => actualizarCampo('genero', event.target.value)}>
                  {generosCatalogo.filter(opcion => opcion !== 'Todos').map(opcion => <option key={opcion}>{opcion}</option>)}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label text-secondary small" htmlFor="admin-imagen">Ruta de portada (opcional)</label>
                <input id="admin-imagen" className="form-control admin-input" value={formulario.imagen} onChange={event => actualizarCampo('imagen', event.target.value)} placeholder="/images/catalogo/portada.jpg" />
              </div>
              <div className="col-12">
                <label className="form-label text-secondary small" htmlFor="admin-sinopsis">Sinopsis (opcional)</label>
                <textarea id="admin-sinopsis" className="form-control admin-input" rows={3} value={formulario.sinopsis} onChange={event => actualizarCampo('sinopsis', event.target.value)} maxLength={1000} />
              </div>
              <div className="col-12">
                <div className="form-check">
                  <input id="admin-digital" className="form-check-input" type="checkbox" checked={formulario.digital} onChange={event => actualizarCampo('digital', event.target.checked)} />
                  <label className="form-check-label text-white small" htmlFor="admin-digital">Disponible solo en formato digital</label>
                </div>
              </div>
              <div className="col-12 text-end">
                <button className="btn-magenta" type="submit">Guardar en catálogo e inventario</button>
              </div>
            </div>
          </form>
        )}

        <div className="d-flex flex-wrap gap-3 align-items-center justify-content-between mb-3">
          <label className="admin-search flex-grow-1">
            <i className="fa-solid fa-magnifying-glass text-secondary" aria-hidden="true" />
            <span className="visually-hidden">Buscar manga o autor</span>
            <input value={busqueda} onChange={event => setBusqueda(event.target.value)} placeholder="Buscar por título o autor" />
          </label>
          {esAdministrador && (
            <label className="form-check form-switch mb-0">
              <input className="form-check-input" type="checkbox" checked={verArchivados} onChange={event => setVerArchivados(event.target.checked)} />
              <span className="form-check-label text-secondary small">Mostrar archivados ({archivados})</span>
            </label>
          )}
        </div>

        <div className="d-flex flex-column gap-2">
          {mangasFiltrados.map(manga => {
            const activo = esMangaActivo(manga);
            const stockActual = stockPorManga[manga.id] ?? manga.stock ?? 0;
            const stockMinimo = stockMinimoPorManga[manga.id] ?? 5;
            const esStockBajo = stockActual <= stockMinimo;

            return (
              <article className={`admin-manga-row p-3 rounded-3 ${activo ? '' : 'is-archived'}`} key={manga.id}>
                <img className="admin-manga-cover rounded-2" src={manga.imagen} alt="" onError={event => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = '/images/logo/logoMangaFlow.png';
                }} />
                <div className="flex-grow-1 min-w-0">
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <h3 className="text-white fw-semibold fs-6 mb-0 text-truncate">{manga.titulo}</h3>
                    <span className={`admin-status ${activo ? 'active' : 'archived'}`}>{activo ? 'Visible' : 'Archivado'}</span>
                    {manga.esDigitalOnly && <span className="badge bg-info text-dark">Digital</span>}
                    {esStockBajo && <span className="badge bg-danger">Stock bajo ({stockActual})</span>}
                  </div>
                  <p className="text-secondary small mb-1">{manga.autor || 'Autor no especificado'} · {manga.demografia} · {manga.generos.join(', ')}</p>
                  <p className="text-secondary small mb-0">${manga.precio.toLocaleString('es-CL')} · Stock en almacén: {stockActual} unid.</p>
                </div>
                <div className="d-flex align-items-center gap-2 flex-shrink-0">
                  <label className="admin-stock-control">
                    <span className="visually-hidden">Stock de {manga.titulo}</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={stockActual}
                      onChange={event => actualizarStockLocal(manga, event.target.value)}
                      onBlur={() => guardarStockEnServidor(manga)}
                      disabled={!activo}
                    />
                  </label>
                  <div className="d-flex flex-wrap align-items-center justify-content-end gap-2">
                    {(activo || esAdministrador) && (
                      <button
                        className={`btn btn-sm ${activo ? 'btn-outline-warning' : 'btn-outline-success'}`}
                        type="button"
                        onClick={() => cambiarVisibilidad(manga)}
                      >
                        <i className={`fa-solid ${activo ? 'fa-box-archive' : 'fa-rotate-left'} me-1`} aria-hidden="true" />
                        {activo ? 'Archivar' : 'Restaurar'}
                      </button>
                    )}
                    {esAdministrador && (
                      <button
                        className="btn btn-sm btn-outline-danger"
                        type="button"
                        onClick={() => eliminarManga(manga)}
                        aria-label={`Eliminar definitivamente ${manga.titulo}`}
                      >
                        <i className="fa-solid fa-trash me-1" aria-hidden="true" />
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
          {mangasFiltrados.length === 0 && (
            <p className="text-secondary text-center py-4 mb-0">No hay mangas que coincidan con la búsqueda.</p>
          )}
        </div>
      </section>
    </main>
  );
};