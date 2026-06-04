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
```
