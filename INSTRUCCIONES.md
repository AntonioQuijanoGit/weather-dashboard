# 🚀 INSTRUCCIONES PARA LANZAR LA APLICACIÓN

## Pasos Rápidos

### 1. Navegar al directorio del proyecto
```bash
cd weather-dashboard
```

### 2. Instalar dependencias (solo la primera vez)
```bash
npm install
```

### 3. Iniciar la aplicación
```bash
npm start
```

O alternativamente:
```bash
ng serve
```

### 4. Abrir en el navegador
Abre tu navegador y ve a:
```
http://localhost:4200/
```

## ✅ Qué esperar

La aplicación comenzará automáticamente a:
- ✨ Mostrar datos en tiempo real cada 5 segundos
- 📊 Actualizar los gráficos progresivamente
- 🌡️ Visualizar temperatura en °C
- ⚡ Visualizar energía en kWh
- 📈 Mantener un historial visual de los últimos 60 puntos

## 🛠️ Comandos Adicionales

### Compilar para producción
```bash
ng build
```

### Ejecutar tests
```bash
ng test
```

### Ver en modo debug
```bash
ng serve --open
```

## 📝 Requisitos

- Node.js v18 o superior
- npm (incluido con Node.js)
- Navegador moderno (Chrome, Firefox, Safari, Edge)

## 🔍 Verificación

Si todo está correcto, verás:
1. El servidor iniciándose en http://localhost:4200/
2. Un dashboard con gradiente púrpura en el header
3. Tarjetas mostrando valores actuales
4. Gráficos actualizándose cada 5 segundos
5. Un indicador verde pulsante con "Actualizando datos..."

## ⚠️ Solución de Problemas

### Puerto 4200 ya en uso
```bash
ng serve --port 4300
```

### Problemas con dependencias
```bash
rm -rf node_modules package-lock.json
npm install
```

### La aplicación no se actualiza
- Verifica la consola del navegador (F12)
- Asegúrate de que JavaScript esté habilitado
- Prueba en modo incógnito

---

## 📸 Captura de Pantalla

Consulta el archivo `preview.html` para ver una representación visual de la aplicación.
La captura real muestra:
- Dashboard completamente funcional
- Gráficos interactivos con Chart.js
- Actualización en tiempo real
- Diseño responsivo

---

**¡Disfruta del dashboard!** 🌤️📊
