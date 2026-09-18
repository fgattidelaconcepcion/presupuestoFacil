/**
 * Migración: los materiales pasan a descontar por lo RECIBIDO.
 *
 * Antes, el precio de un material se descontaba del presupuesto apenas se
 * cargaba (precio × cantidad PEDIDA). Ahora descuenta precio × cantidad
 * RECIBIDA. Los materiales cargados con la regla vieja ya descontaron de más,
 * así que hay que devolverle al presupuesto la parte que todavía no llegó:
 *
 *     budgetRemaining += Σ precio × (cantidad pedida − cantidad recibida)
 *
 * IMPORTANTE: correr UNA sola vez, apenas se despliega la versión nueva.
 * Los materiales cargados después ya no descuentan al crearse, así que
 * correrlo dos veces le regalaría plata al presupuesto.
 *
 * Uso:
 *   node scripts/migrar-materiales-a-recibido.js           (simulación)
 *   node scripts/migrar-materiales-a-recibido.js --apply   (aplica)
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n,
  );

async function main() {
  const aplicar = process.argv.includes("--apply");

  const projects = await prisma.project.findMany({
    include: { materialOrders: { include: { items: true } } },
    orderBy: { createdAt: "asc" },
  });

  let totalAjuste = 0;
  let obrasTocadas = 0;

  for (const p of projects) {
    const items = p.materialOrders.flatMap((o) => o.items);
    const ajuste = items.reduce((sum, i) => {
      const porLlegar = (i.quantityOrdered ?? 0) - (i.quantityReceived ?? 0);
      return sum + (i.unitPrice ?? 0) * porLlegar;
    }, 0);
    const redondeado = Math.round(ajuste * 100) / 100;
    if (redondeado === 0) continue;

    obrasTocadas++;
    totalAjuste += redondeado;
    const nuevo = Math.round((p.budgetRemaining + redondeado) * 100) / 100;
    console.log(
      `${p.name}\n  saldo ${fmt(p.budgetRemaining)} → ${fmt(nuevo)}  (devuelve ${fmt(redondeado)} de material pedido y no recibido)`,
    );

    if (aplicar) {
      await prisma.project.update({
        where: { id: p.id },
        data: { budgetRemaining: nuevo },
      });
    }
  }

  console.log(
    `\n${obrasTocadas} obra(s) ${aplicar ? "ajustadas" : "a ajustar"}, total ${fmt(totalAjuste)}.`,
  );
  if (!aplicar)
    console.log("Simulación: volvé a correrlo con --apply para aplicarlo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
