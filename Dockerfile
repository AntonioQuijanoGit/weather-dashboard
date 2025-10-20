# Etapa 1: build de Angular
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Etapa 2: Nginx para servir la app
FROM nginx:alpine
COPY --from=build /app/dist/weather-dashboard/browser /usr/share/nginx/html
# usa el nginx.conf de la raíz:
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
