/**
 * Deja en la cuenta del cliente SOLO las obras reales, y devuelve
 * las de prueba a la cuenta de test.
 *
 * Contexto: el UPDATE del 8/9 movió TODAS las obras de test@gmail.com
 * a mbernini@gmail.com. Esto revierte las que no corresponden.
 *
 * Uso (desde la carpeta del proyecto):
 *   node scripts/fix-obras.js            -> solo muestra qué haría (dry run)
 *   node scripts/fix-obras.js --apply    -> aplica los cambios
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ── Configuración ──────────────────────────────────────────
const EMAIL_CLIENTE = "mbernini@gmail.com";
const EMAIL_TEST = "test@gmail.com";

// IDs de las obras que SÍ tienen que quedar en la cuenta del cliente.
// Agregá más ids acá si aparece alguna otra obra real.
const OBRAS_DEL_CLIENTE = [
  "cmq1na4pg0002m3trq0z6s5c6", // Don Quijote — Lote 157
];
// ───────────────────────────────────────────────────────────

const APPLY = process.argv.includes("--apply");

async function main() {
  const cliente = await prisma.user.findUnique({ where: { email: EMAIL_CLIENTE } });
  const test = await prisma.user.findUnique({ where: { email: EMAIL_TEST } });

  if (!cliente) throw new Error(`No existe el usuario ${EMAIL_CLIENTE}`);
  if (!test) throw new Error(`No existe el usuario ${EMAIL_TEST}`);

  const obras = await prisma.project.findMany({
    where: { userId: cliente.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      budget: true,
      active: true,
      createdAt: true,
    },
  });

  console.log(`\nObras hoy en la cuenta de ${cliente.name} <${cliente.email}>: ${obras.length}\n`);

  const sePasan = [];
  for (const o of obras) {
    const queda = OBRAS_DEL_CLIENTE.includes(o.id);
    if (!queda) sePasan.push(o);
    console.log(
      `  ${queda ? "QUEDA  " : "→ MUEVE"}  ${o.id}  ${o.name}` +
        `${o.active ? "" : " (finalizada)"}  $${o.budget}`,
    );
  }

  // Aviso si algún id configurado no está en esta cuenta
  for (const id of OBRAS_DEL_CLIENTE) {
    if (!obras.some((o) => o.id === id)) {
      console.log(`\n  ⚠ La obra ${id} NO está en esta cuenta. Revisá el id.`);
    }
  }

  console.log(
    `\nSe moverían ${sePasan.length} obra(s) a ${test.name} <${test.email}>.`,
  );

  if (!APPLY) {
    console.log("\nDry run: no se cambió nada. Corré con --apply para aplicarlo.\n");
    return;
  }

  const res = await prisma.project.updateMany({
    where: { id: { in: sePasan.map((o) => o.id) } },
    data: { userId: test.id },
  });

  const quedan = await prisma.project.findMany({
    where: { userId: cliente.id },
    select: { id: true, name: true, active: true },
  });

  console.log(`\n✅ Movidas ${res.count} obra(s).`);
  console.log(`\nLe quedan a ${cliente.name}:`);
  quedan.forEach((o) =>
    console.log(`  ${o.id}  ${o.name}${o.active ? "" : " (finalizada)"}`),
  );
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
