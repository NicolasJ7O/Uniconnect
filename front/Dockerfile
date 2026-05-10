# Stage 1: Builder
# Utilizamos node lts para la compilación
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar configuración e instalar dependencias
COPY package*.json ./
RUN npm ci

# Copiar todo el código fuente
COPY . .

# Al ser Expo Router, debemos hacer el export estático
# NOTA: exporta el sitio web usando el runtime de Expo
RUN npx expo export -p web

# Stage 2: Runner
# Servidor web super liviano que reemplaza entornos react en prod
FROM nginx:alpine AS runner

# Configurar timezone (opcional pero recomendado)
ENV TZ=UTC

# Se borra la página por defecto de nginx
RUN rm -rf /usr/share/nginx/html/*

# Copiamos la configuración recomendada de nginx para SPA y fallback to index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Se copia únicamente la carpeta generada por expo en la etapa de builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Exponer el puerto por el que corre Nginx
EXPOSE 80

# Levantar nginx con demonio desactivado
CMD ["nginx", "-g", "daemon off;"]
