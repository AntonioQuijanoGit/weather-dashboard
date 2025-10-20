# Dashboard Meteorológico - Meteologica

## 📋 Descripción del Proyecto

Aplicación web desarrollada en **Angular** que visualiza datos de predicción meteorológica en tiempo real. La aplicación simula el streaming progresivo de datos cada 5 segundos, mostrando temperatura media y energía producida con gráficos interactivos.

## ✨ Características Principales

- **Streaming Progresivo**: Actualización automática de datos cada 5 segundos
- **Visualización en Tiempo Real**: Dashboard con valores actuales destacados
- **Gráficos Interactivos**: Representación visual con intervalos minutales usando Chart.js
- **Diseño Responsivo**: Interfaz adaptable a diferentes tamaños de pantalla
- **Arquitectura Modular**: Servicios Angular para gestión eficiente de datos
- **Conversión de Unidades**: 
  - Temperatura: de deciKelvins (dK) a grados Celsius (°C)
  - Energía: visualizada en kilovatios-hora (kWh)

## 🛠️ Tecnologías Utilizadas

- **Framework**: Angular (standalone components)
- **Lenguaje**: TypeScript
- **Gráficos**: Chart.js 4.4.0
- **Procesamiento de datos**: js-yaml (para archivos YAML)
- **Estilos**: CSS3 con variables personalizadas
- **Programación Reactiva**: RxJS (Observables, BehaviorSubject)

## 📦 Estructura del Proyecto

```
weather-dashboard/
├── src/
│   ├── app/
│   │   ├── app.component.ts             # Componente principal del dashboard
│   │   ├── app.component.html           # Template del dashboard
│   │   ├── app.component.css            # Estilos del componente
│   │   ├── services/
│   │   │   ├── weather-data-loader.service.ts   # Carga y parseo del archivo YAML
│   │   │   ├── weather-converter.service.ts     # Conversión de unidades (dK → °C, kWh, etc.)
│   │   │   └── weather-stream.service.ts        # Streaming progresivo y emisión de datos
│   │   └── app.config.ts                # Configuración global de la aplicación
│   ├── styles.css                       # Estilos globales
│   └── index.html                       # HTML principal
├── package.json                         # Dependencias del proyecto
├── angular.json                         # Configuración de Angular
├── tsconfig.json                        # Configuración de TypeScript
└── README.md                            # Este archivo
```

## 🚀 Instalación y Ejecución

### Prerrequisitos

- Node.js (versión 18 o superior)
- npm (viene incluido con Node.js)

### Pasos para ejecutar la aplicación

1. **Instalar las dependencias**:
```bash
npm install
```

2. **Iniciar el servidor de desarrollo**:
```bash
npm start
```
O alternativamente:
```bash
ng serve
```

3. **Abrir el navegador**:
Navega a `http://localhost:4200/`

La aplicación se recargará automáticamente si realizas cambios en los archivos fuente.

## 📊 Funcionamiento de la Aplicación

1. **Carga de datos**: El servicio WeatherDataLoaderService lee y parsea el archivo YAML, transformando su contenido en un formato adecuado para la aplicación.

2. **Streaming progresivo**: El servicio WeatherStreamService emite cada 5 segundos el siguiente punto de datos contenido en el archivo, reproduciendo el comportamiento de un flujo en tiempo real.

3. **Actualización de la UI**: El componente principal se suscribe a los observables de los servicios y actualiza dinámicamente:

        - Valores actuales (tarjetas superiores)
        - Gráficos históricos (últimos 60 puntos)
        - Estadísticas de procesamiento

### Servicios y componentes

### 1. WeatherDataLoaderService
-Carga y parsea el archivo YAML.
-Expone los datos listos para emitir en el streaming.

### 2. WeatherStreamService
-Emite cada 5 segundos el siguiente punto de datos.
-Simula el comportamiento de una fuente en tiempo real.
-Mantiene un buffer con el historial de datos recientes.

### 3. WeatherConverterService
-Convierte unidades meteorológicas a formatos legibles:
-Temperatura: dK → °C
-Energía: Wh → kWh
-Garantiza consistencia de datos para la visualización.

### 4.AppComponent
-Renderiza el dashboard completo.
-Gestiona las suscripciones a los servicios.
-Controla el ciclo de vida de los gráficos y la UI.

## 🎨 Diseño y UX

### Paleta de Colores
- **Acento (var(--accent))**: `#0EA5A2` (turquesa)  
- **Serie Temperatura (línea + sparkline)**: `#0EA5A2`  
- **Serie Energía (línea discontinua + sparkline)**: `#475569` (slate)  
- **Tendencia**: ↑ `#16a34a` · ↓ `#ef4444`  
- **Estado activo (dot / pill)**: `#10b981`  
- **Superficie / fondos**: `var(--surface)` (claro/oscuro según tema)  
- **Bordes**: `var(--border)` / hover `var(--border-hover)`  
- **Texto secundario**: `var(--text-2)`

> Nota: el **tema claro/oscuro** se aplica con `body.theme-dark`; el interruptor de tema usa el mismo set de tokens.

### Características de Diseño
- Layout limpio con **cards** (bordes suaves y sombras sutiles)  
- **Sparklines** en canvas, nítidas desde el inicio (DPR-aware)  
- **Microinteracciones**: hover en iconos/títulos, pill con pulso en estado  
- **Accesibilidad**: focus visible, labels ARIA en gráficos  
- **Responsivo**: grids que colapsan a 1 columna en móviles

## 📈 Optimizaciones Implementadas

### Eficiencia en el Manejo de Datos
- **Ventana deslizante**: Solo se mantienen los últimos 60 puntos en el historial para los gráficos
- **Actualización incremental**: Se agregan datos de uno en uno sin recargar todo el conjunto
- **Animaciones optimizadas**: Uso de `update('none')` en Chart.js para transiciones suaves

### Gestión de Memoria
- Limpieza de subscripciones en `ngOnDestroy()`
- Destrucción de gráficos al desmontar el componente
- Uso eficiente de BehaviorSubject para valores actuales

### Rendimiento
- Componentes standalone para carga bajo demanda
- Imports selectivos de Chart.js
- CSS optimizado con variables para facilitar mantenimiento

## 📝 Requisitos de la Prueba Técnica

- ✅ Streaming progresivo cada 5 s  
- ✅ Visualización en tiempo real del último valor  
- ✅ Gráficos con intervalos minutales  
- ✅ Conversión de unidades dK → °C  
- ✅ Diseño responsive con modo claro/oscuro

### Conversión de Unidades
La aplicación incluye la función `convertDKToCelsius()` para convertir deciKelvins a Celsius:

```typescript
convertDKToCelsius(dK: number): number {
  return ((dK / 10) - 273.15);
}
```

Fórmula: °C = (dK / 10) - 273.15

### Formato de Datos YAML Esperado
```yaml
temperature:
  unit: "dK"
  values:
    - time: "00:00:00"
      value: 2921
    - time: "00:00:05"
      value: 2921
```

## 👤 ANTONIO QUIJANO BERNEDO

Dashboard desarrollado como prueba de selección para Meteologica.

**Tecnologías principales**: Angular, TypeScript, Chart.js, RxJS
