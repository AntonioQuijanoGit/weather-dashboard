# Dashboard Meteorológico - Meteologica

## 📋 Descripción del Proyecto

Aplicación web desarrollada en **Angular 17** que visualiza datos de predicción meteorológica en tiempo real. La aplicación simula el streaming progresivo de datos cada 5 segundos, mostrando temperatura media y energía producida con gráficos interactivos.

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

- **Framework**: Angular 17 (standalone components)
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
│   │   ├── app.component.ts       # Componente principal
│   │   ├── app.component.html     # Template del dashboard
│   │   ├── app.component.css      # Estilos del componente
│   │   ├── weather-data.service.ts # Servicio de datos
│   │   └── app.config.ts          # Configuración de la app
│   ├── styles.css                 # Estilos globales
│   └── index.html                 # HTML principal
├── package.json                   # Dependencias del proyecto
├── angular.json                   # Configuración de Angular
├── tsconfig.json                  # Configuración de TypeScript
└── README.md                      # Este archivo
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

### Flujo de Datos

1. **Generación de Datos**: El servicio `WeatherDataService` genera datos simulados para 24 horas con intervalos de 5 segundos (17,280 puntos de datos totales).

2. **Streaming Progresivo**: Cada 5 segundos, el servicio emite el siguiente punto de datos simulando una lectura en tiempo real del archivo YAML.

3. **Actualización de UI**: El componente se suscribe a los observables del servicio y actualiza:
   - Valores actuales (tarjetas superiores)
   - Gráficos históricos (últimos 60 puntos)
   - Estadísticas de procesamiento

### Componentes Principales

#### WeatherDataService
- Gestiona el streaming de datos
- Implementa BehaviorSubject para emisión de valores actuales
- Mantiene historial de datos para visualización
- Convierte unidades (dK → °C)
- Simula datos realistas con variación horaria

#### AppComponent
- Renderiza el dashboard completo
- Inicializa y actualiza gráficos de Chart.js
- Gestiona subscripciones a observables
- Controla el ciclo de vida de los componentes
- Maneja el temporizador de tiempo transcurrido

## 🎨 Diseño y UX

### Paleta de Colores
- **Header**: Gradiente púrpura (#667eea → #764ba2)
- **Temperatura**: Rojo (#e74c3c)
- **Energía**: Azul (#3498db)
- **Fondo**: Gris claro (#ecf0f1)

### Características de Diseño
- Animaciones suaves en tarjetas (hover effects)
- Indicador de estado con animación de pulso
- Sombras y profundidad para jerarquía visual
- Tipografía clara y legible
- Layout responsivo con CSS Grid

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

## 🧪 Posibles Extensiones

1. **Lectura de archivo YAML real**: Sustituir los datos simulados por la lectura del archivo proporcionado
2. **Exportación de datos**: Permitir descargar los datos en CSV o Excel
3. **Filtros temporales**: Añadir controles para seleccionar rangos de tiempo
4. **Alertas**: Notificaciones cuando los valores superen umbrales
5. **Comparación histórica**: Visualizar datos de múltiples días

## 📝 Notas Técnicas

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

## 👤 Autor

Dashboard desarrollado como prueba de selección para Meteologica.

**Tecnologías principales**: Angular 17, TypeScript, Chart.js, RxJS
