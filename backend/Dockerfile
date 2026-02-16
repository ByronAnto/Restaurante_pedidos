FROM node:20-alpine

WORKDIR /app

# Copiar package files
COPY backend/package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código fuente del backend
COPY backend/src/ ./src/

# Copiar frontend (para servir archivos estáticos)
COPY frontend/ ./frontend/

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["node", "src/app.js"]
