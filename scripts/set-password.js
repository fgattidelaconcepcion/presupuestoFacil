/**
 * Cambia la contraseña de un usuario usando el MISMO hash que usa la app
 * (bcryptjs, 12 rounds) — igual que /api/auth/register.
 *
 * Uso (desde la carpeta del proyecto, en PowerShell/CMD):
 *   node scripts/set-password.js mbernini@gmail.com nuevaClave123
 *
 * Usa el DATABASE_URL del archivo .env (la base de Neon de producción).
 */
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error("Uso: node scripts/set-password.js <email> <contraseña>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("La contraseña tiene que tener al menos 8 caracteres.");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No existe ningún usuario con el email "${email}".`);
    const todos = await prisma.user.findMany({ select: { email: true } });
    console.error("Emails en la base:", todos.map((u) => u.email).join(", "));
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { email },
    data: { password: hashed },
  });

  // Verificación: comprueba que la contraseña nueva realmente valida
  const check = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, check.password);

  console.log(`Usuario: ${user.name} <${user.email}>`);
  console.log(`Contraseña actualizada. Verificación bcrypt: ${ok ? "OK ✅" : "FALLÓ ❌"}`);

  const obras = await prisma.project.count({ where: { userId: user.id } });
  console.log(`Obras asociadas a este usuario: ${obras}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
