# Stage 1: Build environment (builder)
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copiar configuración de paquetes y schema de prisma
COPY package*.json ./
COPY prisma ./prisma/

# Instalar todas las dependencias (incluyendo devDependencies para compilar)
RUN npm ci

# Generar el cliente de Prisma
RUN npx prisma generate

# Copiar el código fuente
COPY . .

# Compilar TypeScript
RUN npm run build

# Stage 2: Production environment (runner)
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Archivos de empaquetado y esquema
COPY package*.json ./
COPY prisma ./prisma/

# Instalar únicamente las dependencias de producción
RUN npm ci --omit=dev

# Prisma CLI is needed at runtime to apply pending migrations before startup.
RUN npm install -g prisma@6.19.2

# Copiar cliente prisma generado, para evitar regenerar
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma ./node_modules/@prisma

# Copiar el código compilado de la etapa builder
COPY --from=builder /usr/src/app/dist ./dist

# Crear directorio de subidas (si la app lo necesita)
RUN mkdir -p uploads && chown -R node:node uploads

# Cambiar a usuario no root para mayor seguridad (buena práctica en Alpine)
USER node

# Iniciar la aplicación directamente sin forzar migraciones para evitar crash loops
ENTRYPOINT ["sh", "-c", "exec npm start"]
