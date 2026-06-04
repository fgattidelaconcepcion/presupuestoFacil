# 🏗️ Presupuesto Obra

PWA para control de presupuesto y personal en obras de construcción.

## Stack
- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** — UI mobile-first
- **Prisma ORM** — SQLite (dev) / PostgreSQL (prod)
- **NextAuth.js** — autenticación con email/contraseña
- **jsPDF** — generación de PDF descargable
- **next-pwa** — Progressive Web App

## Instalación local

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tu DATABASE_URL y NEXTAUTH_SECRET

# 3. Crear la base de datos (SQLite)
npm run db:push

# 4. Correr en desarrollo
npm run dev
```

Abrir http://localhost:3000

## Deploy en Vercel (recomendado)

1. Subir el código a GitHub
2. Importar el repo en [vercel.com](https://vercel.com)
3. Configurar variables de entorno en Vercel:
   - `DATABASE_URL` → string de conexión PostgreSQL (ej: Vercel Postgres, Neon, Supabase)
   - `NEXTAUTH_SECRET` → string seguro (generá con `openssl rand -base64 32`)
   - `NEXTAUTH_URL` → URL de tu deploy (ej: `https://tu-app.vercel.app`)
4. En el primer deploy, correr `npx prisma db push` con la URL de producción

### Base de datos gratuita recomendada

- **[Neon](https://neon.tech)** — PostgreSQL serverless, plan free generoso
- **[Supabase](https://supabase.com)** — PostgreSQL, plan free con 500MB
- **[Vercel Postgres](https://vercel.com/storage/postgres)** — Integrado con Vercel

## Pasar de SQLite a PostgreSQL

En `prisma/schema.prisma`, cambiar:
```prisma
datasource db {
  provider = "postgresql"  // ← cambiar de "sqlite"
  url      = env("DATABASE_URL")
}
```

## Funcionalidades

- ✅ Login / Registro de usuarios
- ✅ Múltiples obras por usuario
- ✅ Presupuesto total con indicador de consumo
- ✅ Gestión de empleados con jornal diario en USD
- ✅ Planilla de asistencia semanal (Lun–Sáb)
- ✅ Botón "Cobrar semana" con cálculo automático
- ✅ Descuento automático del presupuesto
- ✅ Historial de semanas pagas
- ✅ Exportar PDF de liquidación semanal
- ✅ PWA instalable en celular (Android/iOS)
