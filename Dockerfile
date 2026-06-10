# Dockerfile

# --- Etapa de Build ---
# Usamos una imagen completa de Node para instalar dependencias y construir el proyecto
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Si tu proyecto tiene un paso de 'build' (ej. TypeScript), colócalo aquí
# RUN npm run build

# --- Etapa de Producción ---
# Usamos una imagen más ligera para ejecutar la aplicación
FROM node:18-alpine
WORKDIR /app
# Copiamos las dependencias instaladas desde la etapa 'builder'
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
# Copiamos el resto del código fuente
COPY --from=builder /app .
# El puerto que tu backend expone internamente
EXPOSE 3001
# El comando para iniciar tu aplicación
CMD [ "npm", "start" ]