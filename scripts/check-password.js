/**
 * Prueba una contraseña contra la base SIN cambiar nada.
 * Sirve para verificar exactamente lo que el cliente está tipeando.
 *
 * Uso:
 *   node scripts/check-password.js mbernini@gmail.com "loQueTipeaElCliente"
 *
 * Poné la clave entre comillas si tiene símbolos o espacios.
 */
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Uso: node scripts/check-password.js <email> "<contraseña>"');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`❌ No existe ningún usuario con el email "${email}"`);
    const todos = await prisma.user.findMany({ select: { email: true } });
    todos.forEach((u) => console.log(`   - "${u.email}"`));
    return;
  }

  const ok = await bcrypt.compare(password, user.password);
  console.log(`Usuario:     "${user.email}" (${user.name})`);
  console.log(`Probando:    "${password}"  (${password.length} caracteres)`);
  console.log(ok ? "✅ ENTRA — esta contraseña es correcta" : "❌ NO ENTRA — no coincide");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
