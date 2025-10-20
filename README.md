### 🌤️ Dashboard Meteorológico – Meteologica

### 📸 Vista de la aplicación
![Dashboard Meteorológico](./docs/screenshot.png)

### 📋 Descripción del Proyecto
Aplicación web desarrollada en Angular que visualiza datos de predicción meteorológica en tiempo real. La aplicación simula el streaming progresivo de datos cada 5 segundos, mostrando temperatura media y energía producida con gráficos interactivos y actualizaciones automáticas.

### ✨ Características Principales

-⚡ Streaming Progresivo: actualización automática cada 5 s

-📊 Visualización en tiempo real: KPIs actualizados dinámicamente

-📈 Gráficos interactivos: intervalos minutales con tooltips precisos

-📱 Diseño responsivo: interfaz adaptable a cualquier dispositivo

-🧠 Arquitectura modular: servicios desacoplados para datos y conversión

-🔁 Conversión automática de unidades:

-Temperatura: de deciKelvins (dK) a °C

-Energía: en kilovatios-hora (kWh)

### 🛠️ Tecnologías Utilizadas

-Framework: Angular (standalone components)

-Lenguaje: TypeScript

-Gráficos: Chart.js 4.4.0

-Procesamiento de datos: js-yaml

-Estilos: CSS3 con variables personalizadas

-Programación reactiva: RxJS (Observables, BehaviorSubject)

## 📦 Estructura del Proyecto



weather-dashboard/
├── src/
│   ├── app/
│   │   ├── app.component.ts             # Componente principal
│   │   ├── app.component.html           # Template del dashboard
│   │   ├── app.component.css            # Estilos del componente
│   │   ├── services/
│   │   │   ├── weather-data-loader.service.ts   # Carga y parseo YAML
│   │   │   ├── weather-converter.service.ts     # Conversión de unidades
│   │   │   └── weather-stream.service.ts        # Streaming de datos
│   │   └── app.config.ts                # Configuración global
│   ├── styles.css                       # Estilos globales
│   └── index.html                       # HTML principal
├── package.json                         # Dependencias
├── angular.json                         # Configuración Angular
├── tsconfig.json                        # Configuración TypeScript
└── README.md                            # Este archivo

### 🚀 Instalación y Ejecución
### ✅ Prerrequisitos

-Node.js (v18 o superior)

-npm (incluido con Node.js)

### ▶️ Pasos para ejecutar la app

### Instalar dependencias

npm install


### Iniciar el servidor de desarrollo

npm start


o

ng serve


### Abrir en el navegador

http://localhost:4200/

### 📊 Funcionamiento de la Aplicación

### Carga de datos
El servicio WeatherDataLoaderService lee y parsea el archivo YAML.

### Streaming progresivo
WeatherStreamService emite cada 5 s el siguiente punto de datos.

### Actualización de la UI
El componente principal actualiza:

-Valores actuales (tarjetas superiores)

-Gráficos históricos (últimos 60 puntos)

-Estadísticas

### 🔧 Servicios y Componentes
1. WeatherDataLoaderService

-Carga y parsea el archivo YAML.

-Expone los datos preparados para el streaming.

2. WeatherStreamService

-Emite cada 5 s nuevos datos.

-Mantiene un buffer con el historial reciente.

3. WeatherConverterService

-Convierte unidades meteorológicas a formatos legibles:

-Temperatura: dK → °C

-Energía: Wh → kWh

4. AppComponent

-Renderiza el dashboard completo.

-Gestiona suscripciones y ciclo de vida de la UI.

### 🎨 Diseño y UX

-Acento: #0EA5A2

-Serie Temperatura: #0EA5A2

-Serie Energía: #475569

-Tendencias: ↑ #16a34a · ↓ #ef4444

### Características:

-Layout limpio con cards

-Sparklines optimizados para retina

-Microinteracciones y accesibilidad

-Responsivo desde escritorio hasta móvil

### 📈 Optimizaciones Implementadas

-Ventana deslizante: solo últimos 60 puntos

-Actualización incremental: sin recargar dataset

-Animaciones optimizadas con update('none')

-Limpieza de memoria en ngOnDestroy()

-Imports selectivos de Chart.js

### 📝 Requisitos de la Prueba Técnica

✅ Streaming progresivo cada 5 s

✅ Visualización en tiempo real

✅ Gráficos minutales

✅ Conversión dK → °C

✅ Diseño responsive con tema oscuro

### 📚 Instrucciones de Uso
### 🔧 Comandos útiles
ng build             # Compilar para producción
ng test              # Ejecutar tests
ng serve --open      # Abrir automáticamente el navegador

### ⚠️ Solución de Problemas

Puerto 4200 ocupado:

ng serve --port 4300


### Problemas de dependencias:

rm -rf node_modules package-lock.json
npm install


### La app no actualiza:

Revisa consola (F12)

Habilita JavaScript

Prueba modo incógnito

### 🐳 Ejecución con Docker

Puedes desplegar la aplicación sin instalar Node.js usando Docker:

🛠️ Construir la imagen
docker build -t weather-dashboard .

### ▶️ Ejecutar el contenedor
docker run --name weather-dashboard -d -p 8080:80 weather-dashboard


### 📍 Accede en: http://localhost:8080

### 🔄 Ciclo de redeploy
docker stop weather-dashboard || true
docker rm weather-dashboard || true
docker build -t weather-dashboard .
docker run --name weather-dashboard -d -p 8080:80 weather-dashboard

### 📊 Logs y mantenimiento
docker logs -f weather-dashboard
docker stop weather-dashboard
docker rm weather-dashboard


### 💡 Si el puerto 8080 está ocupado, usa otro: -p 8081:80

### 📦 Opción con docker-compose

docker-compose.yml:

services:
  weather-dashboard:
    build: .
    image: weather-dashboard:latest
    ports:
      - "8080:80"
    container_name: weather-dashboard
    restart: unless-stopped


### Comandos:

docker compose up -d
docker compose logs -f
docker compose down

### 🐳 Cómo funciona el Dockerfile

Stage 1 (Node 18-alpine): instala dependencias y compila Angular.

Stage 2 (nginx:alpine): sirve los archivos estáticos desde /usr/share/nginx/html.

✅ Resultado: imagen ligera, rápida y lista para producción.

📐 Conversión de Unidades
convertDKToCelsius(dK: number): number {
  return (dK / 10) - 273.15;
}


Fórmula: °C = (dK / 10) - 273.15

📁 Formato de datos YAML esperado
temperature:
  unit: "dK"
  values:
    - time: "00:00:00"
      value: 2921
    - time: "00:00:05"
      value: 2921

### 👤 Autor

Antonio Quijano Bernedo
Dashboard desarrollado como prueba técnica para Meteologica.

Tecnologías: Angular · TypeScript · Chart.js · RxJS · Docker