import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  cargarPerfilUsuario,
  rolBackendAFrontend,
  rolFrontendABackend,
  rolPorCorreo,
  type SesionUsuario,
} from '../data/sesion';
import { apiFetch } from '../services/apiClient';

interface LoginProps {
  sesion: SesionUsuario | null;
  alIniciarSesion: (sesion: SesionUsuario) => void;
  alIngresarInvitado: () => void;
  alCerrarSesion: () => void;
}

interface LoginBackendResponse {
  personaId: number;
  correo: string;
  rol: 'CLIENTE' | 'ADMINISTRADOR' | 'OPERADOR';
  token: string;
  mensaje: string;
}

interface PersonaBackendResponse {
  id: number;
  nombre: string;
  correo: string;
  rol: 'CLIENTE' | 'ADMINISTRADOR' | 'OPERADOR';
  activo: boolean;
}

const correoConFormatoValido = (correo: string) => (
  correo.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
);

const obtenerAyudaCorreo = (correo: string) => {
  const valor = correo.trim();
  if (!valor) return '';
  if (valor.length > 100) return 'El correo no puede superar los 100 caracteres.';
  if (!valor.includes('@')) return 'Te falta el @ y el dominio, por ejemplo nombre@duocuc.cl.';
  if ((valor.match(/@/g) ?? []).length > 1) return 'Usa un solo @ en el correo.';

  const [usuario, dominio = ''] = valor.split('@');
  if (!usuario) return 'Escribe el nombre antes del @.';
  if (!dominio) return 'Después del @ escribe tu dominio, por ejemplo duocuc.cl o gmail.com.';
  if (!dominio.includes('.')) return 'Al dominio le falta un punto y su terminación, por ejemplo .com o .cl.';
  if (dominio.endsWith('.')) return 'Después del punto falta la terminación del dominio, por ejemplo com o cl.';
  if (!correoConFormatoValido(valor)) return 'Revisa el correo: debe tener un formato como nombre@duocuc.cl.';
  return 'El formato del correo se ve correcto.';
};

const contrasenaValida = (contrasena: string) => (
  contrasena.length >= 4 && contrasena.length <= 10
);

const obtenerPuntosIniciales = (correo: string) => {
  const clave = `mangaFlow_puntos_${correo.toLocaleLowerCase('es')}`;
  const puntosGuardados = localStorage.getItem(clave);
  if (puntosGuardados !== null) {
    const puntos = Number(puntosGuardados);
    if (Number.isFinite(puntos) && puntos >= 0) return puntos;
  }

  const puntos = Math.floor(500 + Math.random() * 4501);
  localStorage.setItem(clave, String(puntos));
  return puntos;
};

export const Login = ({ sesion, alIniciarSesion, alIngresarInvitado, alCerrarSesion }: LoginProps) => {
  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [correo, setCorreo] = useState('');
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmacionContrasena, setConfirmacionContrasena] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const destino = (location.state as { desde?: string } | null)?.desde;
  const usuarioAutenticado = Boolean(sesion && !sesion.isGuest && sesion.token);
  const ayudaCorreo = obtenerAyudaCorreo(correo);

  const iniciarSesion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const email = correo.trim();
    const password = contrasena.trim();

    if (!correoConFormatoValido(email)) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }
    if (!contrasenaValida(password)) {
      setError('La contraseña debe tener entre 4 y 10 caracteres.');
      return;
    }

    setCargando(true);
    try {
      const respuestaAuth = await apiFetch<LoginBackendResponse>('/mangas/auth/login', {
        method: 'POST',
        body: JSON.stringify({ correo: email, password }),
      });

      let nombreBackend = email.split('@')[0];
      try {
        const persona = await apiFetch<PersonaBackendResponse>(
          `/mangas/personas/${respuestaAuth.personaId}`,
          {
            headers: { Authorization: `Bearer ${respuestaAuth.token}` },
          },
        );
        if (persona?.nombre) nombreBackend = persona.nombre;
      } catch {
      }

      const rolFrontend = rolBackendAFrontend(respuestaAuth.rol);
      const perfil = cargarPerfilUsuario(email);
      const puntos = perfil?.puntos ?? perfil?.points ?? obtenerPuntosIniciales(email);

      alIniciarSesion({
        ...perfil,
        personaId: respuestaAuth.personaId,
        token: respuestaAuth.token,
        role: rolFrontend,
        email: respuestaAuth.correo,
        nombre: nombreBackend,
        registradoEn: perfil?.registradoEn ?? new Date().toISOString(),
        points: puntos,
        puntos,
        isGuest: false,
        wishlist: perfil?.wishlist ?? [],
        compras: perfil?.compras ?? [],
      });

      navigate(destino || (rolFrontend === 'admin' || rolFrontend === 'staff' ? '/admin' : '/inicio'), { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Correo o contraseña incorrectos.');
    } finally {
      setCargando(false);
    }
  };

  const registrarUsuario = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const email = correo.trim();
    const nombre = nombreCompleto.trim();
    const password = contrasena.trim();

    if (nombre.length < 2 || nombre.length > 60) {
      setError('Escribe un nombre de entre 2 y 60 caracteres.');
      return;
    }
    if (!correoConFormatoValido(email)) {
      setError('Ingresa un correo electrónico válido (ej: nombre@duocuc.cl).');
      return;
    }
    if (!contrasenaValida(password)) {
      setError('La contraseña debe tener entre 4 y 10 caracteres.');
      return;
    }
    if (password !== confirmacionContrasena.trim()) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setCargando(true);
    try {
      const rolFrontend = rolPorCorreo(email);
      const rolBackend = rolFrontendABackend(rolFrontend);

      const personaCreada = await apiFetch<PersonaBackendResponse>('/mangas/personas', {
        method: 'POST',
        body: JSON.stringify({
          nombre,
          correo: email,
          telefono: '900000000',
          direccion: 'Sin dirección registrada',
          rol: rolBackend,
        }),
      });

      await apiFetch('/mangas/auth/registrar', {
        method: 'POST',
        body: JSON.stringify({
          personaId: personaCreada.id,
          correo: email,
          password,
          rol: rolBackend,
        }),
      });

      const respuestaAuth = await apiFetch<LoginBackendResponse>('/mangas/auth/login', {
        method: 'POST',
        body: JSON.stringify({ correo: email, password }),
      });

      const puntos = obtenerPuntosIniciales(email);
      alIniciarSesion({
        personaId: personaCreada.id,
        token: respuestaAuth.token,
        role: rolFrontend,
        email,
        nombre,
        registradoEn: new Date().toISOString(),
        points: puntos,
        puntos,
        isGuest: false,
        wishlist: [],
        compras: [],
        biblioteca: [],
      });

      navigate(rolFrontend === 'admin' || rolFrontend === 'staff' ? '/admin' : '/inicio', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear la cuenta en el servidor.');
    } finally {
      setCargando(false);
    }
  };

  const continuarComoInvitado = () => {
    alIngresarInvitado();
    navigate('/inicio', { replace: true });
  };

  return (
    <main className="container login-page py-5">
      <section className="login-card card-panel mx-auto p-4 p-md-5">
        <div className="text-center mb-4">
          <span className="brand-logo d-inline-flex align-items-center justify-content-center mb-3">
            <img src="/images/logo/logoMangaFlow.png" alt="Logo MangaFlow" />
          </span>
          <h1 className="text-white fw-bold fs-3 mb-2">
            {usuarioAutenticado ? `Hola, ${sesion?.nombre || sesion?.email || 'lector'}`
              : sesion?.isGuest ? 'Estás como invitado'
                : modo === 'registro' ? 'Únete a MangaFlow' : 'Acceso a MangaFlow'}
          </h1>
          <p className="text-secondary small mb-0">
            {usuarioAutenticado
              ? 'Tu sesión está iniciada y ya puedes usar tu biblioteca, puntos y carrito.'
              : modo === 'registro'
                ? 'Crea tu cuenta para guardar tus mangas, compras y favoritos.'
                : 'Inicia sesión para gestionar tus compras, puntos y biblioteca digital.'}
          </p>
        </div>

        {usuarioAutenticado ? (
          <div className="d-grid gap-3">
            <Link to="/biblioteca" className="btn-magenta text-center">
              Ir a mi biblioteca
            </Link>
            <button className="btn btn-outline-light" type="button" onClick={alCerrarSesion}>
              <i className="fa-solid fa-right-from-bracket me-2" aria-hidden="true" />
              Cerrar sesión
            </button>
          </div>
        ) : (
          <>
            {error && <div className="alert alert-danger py-2 small" role="alert">{error}</div>}

            <form onSubmit={modo === 'registro' ? registrarUsuario : iniciarSesion} noValidate>
              {modo === 'registro' && (
                <div className="mb-3">
                  <label htmlFor="register-name" className="form-label text-white small fw-semibold">Nombre</label>
                  <input
                    id="register-name"
                    className="form-control bg-dark text-white border-secondary border-opacity-25"
                    type="text"
                    autoComplete="off"
                    placeholder="Tu nombre"
                    value={nombreCompleto}
                    onChange={event => setNombreCompleto(event.target.value)}
                    maxLength={60}
                    required
                  />
                </div>
              )}
              <div className="mb-3">
                <label htmlFor={modo === 'registro' ? 'register-email' : 'login-email'} className="form-label text-white small fw-semibold">Correo electrónico</label>
                <input
                  id={modo === 'registro' ? 'register-email' : 'login-email'}
                  className={`form-control bg-dark text-white border-secondary border-opacity-25 ${ayudaCorreo && (ayudaCorreo.startsWith('El formato') ? 'email-hint-valid' : 'email-hint-invalid')}`}
                  type="email"
                  autoComplete="off"
                  placeholder="nombre@duocuc.cl"
                  value={correo}
                  onChange={event => setCorreo(event.target.value)}
                  aria-describedby={modo === 'registro' ? 'register-email-hint' : 'login-email-hint'}
                  required
                />
                <div id={modo === 'registro' ? 'register-email-hint' : 'login-email-hint'} className="form-text text-secondary login-hint">
                  {modo === 'registro'
                    ? 'Ingresa cualquier correo electrónico válido (ej: @duocuc.cl, @gmail.com)'
                    : 'Ingresa tu correo registrado'}
                </div>
                {ayudaCorreo && (
                  <div
                    className={`email-live-hint ${ayudaCorreo.startsWith('El formato') ? 'valid' : 'invalid'}`}
                    aria-live="polite"
                  >
                    <i
                      className={`fa-solid ${ayudaCorreo.startsWith('El formato') ? 'fa-circle-check' : 'fa-circle-info'}`}
                      aria-hidden="true"
                    />
                    {ayudaCorreo}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label htmlFor={modo === 'registro' ? 'register-password' : 'login-password'} className="form-label text-white small fw-semibold">Contraseña</label>
                <input
                  id={modo === 'registro' ? 'register-password' : 'login-password'}
                  className="form-control bg-dark text-white border-secondary border-opacity-25"
                  type="password"
                  autoComplete={modo === 'registro' ? 'new-password' : 'current-password'}
                  placeholder="••••••••"
                  value={contrasena}
                  onChange={event => setContrasena(event.target.value)}
                  minLength={4}
                  maxLength={10}
                  required
                />
                <div className="form-text text-secondary login-hint">Entre 4 y 10 caracteres</div>
              </div>

              {modo === 'registro' && (
                <div className="mb-4">
                  <label htmlFor="register-password-confirm" className="form-label text-white small fw-semibold">Confirma tu contraseña</label>
                  <input
                    id="register-password-confirm"
                    className="form-control bg-dark text-white border-secondary border-opacity-25"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirmacionContrasena}
                    onChange={event => setConfirmacionContrasena(event.target.value)}
                    minLength={4}
                    maxLength={10}
                    required
                  />
                </div>
              )}

              <button className="btn-magenta w-100" type="submit" disabled={cargando}>
                <i className={`fa-solid ${modo === 'registro' ? 'fa-user-plus' : 'fa-right-to-bracket'} me-2`} aria-hidden="true" />
                {cargando ? 'Conectando...' : modo === 'registro' ? 'Crear cuenta' : 'Iniciar sesión'}
              </button>
            </form>

            <p className="text-center small mt-3 mb-0">
              <span className="text-secondary">
                {modo === 'registro' ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?'}
              </span>{' '}
              <button
                type="button"
                className="login-mode-toggle"
                onClick={() => {
                  setError('');
                  setModo(actual => actual === 'login' ? 'registro' : 'login');
                }}
              >
                {modo === 'registro' ? 'Inicia sesión' : 'Regístrate'}
              </button>
            </p>

            {modo === 'login' && (
              <>
                <div className="login-divider"><span>O CONTINÚA COMO</span></div>

                <button className="btn btn-outline-secondary w-100 fw-semibold text-white" type="button" onClick={continuarComoInvitado}>
                  <i className="fa-solid fa-user-secret me-2" aria-hidden="true" />
                  Ingresar como invitado
                </button>
                <div className="login-warning mt-3 p-2 small text-center">
                  El invitado no tiene acceso a la biblioteca ni a puntos, y no puede usar el carrito de compras.
                </div>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
};