/**
 * Prueba el login contra PRODUCCIÓN, sin navegador.
 * Sirve para saber si el problema es el servidor o es Chrome (autocompletado,
 * contraseña vieja guardada, etc.).
 *
 * Uso:
 *   node scripts/test-login.js mbernini@gmail.com "laClave"
 */
const BASE =
  process.env.APP_URL ||
  "https://presupuesto-facil-franco-s-projects-63b5960c.vercel.app";

const jar = new Map();

function guardarCookies(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of raw) {
    const [par] = c.split(";");
    const i = par.indexOf("=");
    if (i > 0) jar.set(par.slice(0, i).trim(), par.slice(i + 1).trim());
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Uso: node scripts/test-login.js <email> "<contraseña>"');
    process.exit(1);
  }

  console.log(`\nProbando contra: ${BASE}`);
  console.log(`Email:     "${email}"`);
  console.log(`Contraseña: ${password.length} caracteres\n`);

  // 1) CSRF
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  guardarCookies(csrfRes);
  const { csrfToken } = await csrfRes.json();
  console.log(`1. CSRF ....................... ${csrfRes.status}`);

  // 2) Login
  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: `${BASE}/dashboard`,
    json: "true",
  });

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(),
    },
    body,
    redirect: "manual",
  });
  guardarCookies(loginRes);
  const texto = await loginRes.text();
  console.log(`2. Login ...................... ${loginRes.status}`);

  const falló =
    loginRes.status === 401 ||
    texto.includes("error=CredentialsSignin") ||
    texto.includes("/login?");

  // 3) Sesión
  const sesRes = await fetch(`${BASE}/api/auth/session`, {
    headers: { cookie: cookieHeader() },
  });
  const sesion = await sesRes.json();
  console.log(`3. Sesión ..................... ${sesRes.status}\n`);

  if (sesion && sesion.user) {
    console.log(`✅ LOGIN OK — entró como ${sesion.user.name} <${sesion.user.email}>`);
    console.log("   El servidor está bien. Si en Chrome falla, es el navegador");
    console.log("   (contraseña vieja guardada / autocompletado). Probá en incógnito.");
  } else {
    console.log("❌ LOGIN RECHAZADO por el servidor");
    console.log(`   Respuesta: ${texto.slice(0, 200)}`);
    console.log("   Correr: node scripts/check-password.js " + email + ' "' + "..." + '"');
  }
  console.log("");
}

main().catch((e) => {
  console.error("Error de red o del script:", e.message);
  process.exit(1);
});
