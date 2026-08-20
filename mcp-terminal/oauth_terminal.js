/*
 * oauth_terminal.js
 *
 * Servidor de autorizacion OAuth 2.0 minimo, en Node puro, para que un
 * conector remoto de claude.ai pueda "iniciar sesion" contra este servidor.
 *
 * claude.ai, al anadir un conector personalizado, no usa un token puesto a
 * mano: sigue el flujo de autorizacion de MCP, que es OAuth 2.1 con:
 *
 *   1. Metadatos del recurso protegido        (RFC 9728)
 *   2. Metadatos del servidor de autorizacion  (RFC 8414)
 *   3. Registro dinamico de cliente            (RFC 7591)
 *   4. Codigo de autorizacion con PKCE         (RFC 7636)
 *
 * Este modulo implementa esas cuatro piezas. Como el servidor es de un solo
 * usuario detras de un tunel privado, la pantalla de autorizacion se aprueba
 * sola: la seguridad descansa en que la URL del tunel sea secreta, igual que
 * ya ocurria con el token en la ruta.
 *
 * Si quieres una aprobacion explicita, pon la variable de entorno
 * MCP_TERMINAL_APROBACION_MANUAL=1: entonces /authorize muestra una pagina
 * que pide el token del servidor antes de dejar entrar.
 */

'use strict';

const crypto = require('crypto');

const APROBACION_MANUAL = process.env.MCP_TERMINAL_APROBACION_MANUAL === '1';

/* Los tokens de acceso viven 30 dias; los codigos, 5 minutos. */
const VIDA_TOKEN_S = 30 * 24 * 3600;
const VIDA_CODIGO_MS = 5 * 60 * 1000;

const clientes = new Map(); // client_id -> { redirect_uris }
const codigos = new Map(); // code -> { client_id, redirect_uri, code_challenge, metodo, expira }
const tokens = new Map(); // access_token -> { client_id, expira }

function aleatorio(bytes) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/*
 * Base publica del servidor tal y como la ve el cliente. Detras del tunel,
 * la cabecera Host es la del dominio de trycloudflare y el protocolo llega
 * en X-Forwarded-Proto. El emisor (issuer) y todos los endpoints tienen que
 * construirse con esa base o el cliente los rechaza por no coincidir.
 */
function baseDeReq(req) {
  const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const host = (req.headers['x-forwarded-host'] || req.headers.host || 'localhost')
    .split(',')[0]
    .trim();
  return proto + '://' + host;
}

function metadatosRecursoProtegido(base) {
  return {
    resource: base + '/mcp',
    authorization_servers: [base],
    bearer_methods_supported: ['header'],
  };
}

function metadatosServidorAutorizacion(base) {
  return {
    issuer: base,
    authorization_endpoint: base + '/authorize',
    token_endpoint: base + '/token',
    registration_endpoint: base + '/register',
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['terminal'],
  };
}

/* --- helpers de respuesta --- */

function enviarJson(res, codigo, cuerpo, cors) {
  const texto = JSON.stringify(cuerpo);
  cors(res);
  res.writeHead(codigo, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(texto),
  });
  res.end(texto);
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let datos = '';
    req.on('data', (t) => {
      datos += t;
      if (datos.length > 1024 * 1024) {
        reject(new Error('cuerpo demasiado grande'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(datos));
    req.on('error', reject);
  });
}

/* El token endpoint y el registro pueden llegar como JSON o como formulario. */
function parsear(tipo, texto) {
  if (!texto) return {};
  if ((tipo || '').includes('application/json')) return JSON.parse(texto);
  const obj = {};
  for (const [k, v] of new URLSearchParams(texto)) obj[k] = v;
  return obj;
}

function verificarPkce(verificador, reto, metodo) {
  if (!reto) return true; // sin PKCE registrado, no se exige
  if (metodo !== 'S256') return false;
  if (!verificador) return false;
  const calc = crypto.createHash('sha256').update(verificador).digest('base64url');
  const a = Buffer.from(calc);
  const b = Buffer.from(reto);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function purgar() {
  const ahora = Date.now();
  for (const [k, v] of codigos) if (v.expira < ahora) codigos.delete(k);
  for (const [k, v] of tokens) if (v.expira < ahora) tokens.delete(k);
}

/* --- comprobacion de tokens emitidos (la usa el servidor principal) --- */

function tokenAccesoValido(candidato) {
  if (!candidato) return false;
  const reg = tokens.get(candidato);
  if (!reg) return false;
  if (reg.expira < Date.now()) {
    tokens.delete(candidato);
    return false;
  }
  return true;
}

/* --- pagina de aprobacion manual (opcional) --- */

function paginaAprobacion(params) {
  const campos = Object.entries(params)
    .map(
      ([k, v]) =>
        '<input type="hidden" name="' + k + '" value="' + String(v).replace(/"/g, '&quot;') + '">'
    )
    .join('\n');
  return (
    '<!doctype html><meta charset="utf-8"><title>Autorizar terminal</title>' +
    '<body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem">' +
    '<h2>Autorizar acceso a la terminal</h2>' +
    '<p>Una aplicacion pide conectarse a la terminal de esta maquina. ' +
    'Pega el token del servidor para aprobar.</p>' +
    '<form method="POST" action="/authorize">' +
    campos +
    '<input name="token" placeholder="token del servidor" ' +
    'style="width:100%;padding:.6rem;margin:.5rem 0;font-family:monospace" autofocus>' +
    '<button style="padding:.6rem 1.2rem">Aprobar</button>' +
    '</form></body>'
  );
}

function emitirCodigoYredirigir(res, p, cors) {
  const destino = p.redirect_uri;
  if (!destino) {
    enviarJson(res, 400, { error: 'invalid_request', error_description: 'falta redirect_uri' }, cors);
    return;
  }
  const code = 'cod_' + aleatorio(24);
  codigos.set(code, {
    client_id: p.client_id || null,
    redirect_uri: destino,
    code_challenge: p.code_challenge || null,
    metodo: p.code_challenge_method || 'S256',
    expira: Date.now() + VIDA_CODIGO_MS,
  });

  const u = new URL(destino);
  u.searchParams.set('code', code);
  if (p.state) u.searchParams.set('state', p.state);

  cors(res);
  res.writeHead(302, { Location: u.toString() });
  res.end();
}

/*
 * Punto de entrada. Devuelve true si ha atendido la peticion (era de OAuth),
 * false si no le corresponde y el servidor principal debe seguir encaminando.
 *
 *   tokenValidoEstatico: fn(str)->bool, el token "de siempre" del servidor,
 *   que en modo manual sirve para aprobar la pantalla.
 */
async function manejar(req, res, url, cors, tokenValidoEstatico) {
  const ruta = url.pathname;

  /* 1. Metadatos del recurso protegido (con o sin sufijo de ruta). */
  if (req.method === 'GET' && ruta.startsWith('/.well-known/oauth-protected-resource')) {
    enviarJson(res, 200, metadatosRecursoProtegido(baseDeReq(req)), cors);
    return true;
  }

  /* 2. Metadatos del servidor de autorizacion. Se sirve tambien en la ruta
   *    de openid-configuration porque algunos clientes la prueban. */
  if (
    req.method === 'GET' &&
    (ruta.startsWith('/.well-known/oauth-authorization-server') ||
      ruta.startsWith('/.well-known/openid-configuration'))
  ) {
    enviarJson(res, 200, metadatosServidorAutorizacion(baseDeReq(req)), cors);
    return true;
  }

  /* 3. Registro dinamico de cliente. */
  if (req.method === 'POST' && ruta === '/register') {
    let cuerpo;
    try {
      cuerpo = parsear(req.headers['content-type'], await leerCuerpo(req));
    } catch (e) {
      enviarJson(res, 400, { error: 'invalid_client_metadata' }, cors);
      return true;
    }
    const redirects = Array.isArray(cuerpo.redirect_uris) ? cuerpo.redirect_uris : [];
    const clientId = 'cli_' + aleatorio(16);
    clientes.set(clientId, { redirect_uris: redirects });
    enviarJson(
      res,
      201,
      {
        client_id: clientId,
        redirect_uris: redirects,
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code'],
        response_types: ['code'],
      },
      cors
    );
    return true;
  }

  /* 4a. Autorizacion (GET): auto-aprueba, o muestra pagina si es manual. */
  if (ruta === '/authorize' && req.method === 'GET') {
    const p = Object.fromEntries(url.searchParams);
    if (APROBACION_MANUAL) {
      cors(res);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(paginaAprobacion(p));
      return true;
    }
    emitirCodigoYredirigir(res, p, cors);
    return true;
  }

  /* 4b. Autorizacion (POST): llega desde la pagina de aprobacion manual. */
  if (ruta === '/authorize' && req.method === 'POST') {
    const p = parsear(req.headers['content-type'], await leerCuerpo(req));
    if (!tokenValidoEstatico(p.token)) {
      cors(res);
      res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<p>Token incorrecto. Vuelve atras e intentalo de nuevo.</p>');
      return true;
    }
    delete p.token;
    emitirCodigoYredirigir(res, p, cors);
    return true;
  }

  /* 5. Canje del codigo por un token de acceso. */
  if (ruta === '/token' && req.method === 'POST') {
    purgar();
    const p = parsear(req.headers['content-type'], await leerCuerpo(req));

    if (p.grant_type !== 'authorization_code') {
      enviarJson(res, 400, { error: 'unsupported_grant_type' }, cors);
      return true;
    }
    const reg = codigos.get(p.code);
    if (!reg || reg.expira < Date.now()) {
      enviarJson(res, 400, { error: 'invalid_grant' }, cors);
      return true;
    }
    codigos.delete(p.code); // un codigo se usa una sola vez
    if (p.redirect_uri && reg.redirect_uri && p.redirect_uri !== reg.redirect_uri) {
      enviarJson(res, 400, { error: 'invalid_grant', error_description: 'redirect_uri' }, cors);
      return true;
    }
    if (!verificarPkce(p.code_verifier, reg.code_challenge, reg.metodo)) {
      enviarJson(res, 400, { error: 'invalid_grant', error_description: 'pkce' }, cors);
      return true;
    }

    const accessToken = 'at_' + aleatorio(32);
    tokens.set(accessToken, {
      client_id: reg.client_id,
      expira: Date.now() + VIDA_TOKEN_S * 1000,
    });
    enviarJson(
      res,
      200,
      {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: VIDA_TOKEN_S,
        scope: 'terminal',
      },
      cors
    );
    return true;
  }

  return false;
}

module.exports = { manejar, tokenAccesoValido, APROBACION_MANUAL };
