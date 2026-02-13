# Lector de Textos - Text to Speech

Aplicación web personal para convertir textos largos a audio de alta calidad usando Google Cloud Text-to-Speech API.

## Características

- Convierte textos de hasta 100,000 caracteres por sesión
- Divide automáticamente textos largos en fragmentos manejables
- Múltiples voces en español disponibles (España y Latinoamérica)
- Descarga de audio en formato MP3
- Seguimiento del uso mensual de la API
- Interfaz responsive que funciona en móvil y desktop

## Límites gratuitos

Google Cloud Text-to-Speech ofrece:
- 100,000 caracteres mensuales gratis con voces Neural2 (alta calidad)
- 1,000,000 caracteres mensuales gratis con voces Standard (calidad básica)

Con ~10,000 palabras = ~60,000 caracteres, puedes generar aproximadamente 1-2 textos largos por mes con voces Neural2.

## Uso

1. Visita tu sitio en Netlify
2. Pega tu texto o sube un archivo .txt
3. Selecciona la voz que prefieres
4. Haz clic en "Generar Audio"
5. Descarga el MP3 para escuchar mientras caminas

## Configuración técnica

Este proyecto usa:
- **Frontend**: HTML, CSS, JavaScript vanilla (sin frameworks)
- **Backend**: Netlify Functions (serverless)
- **API**: Google Cloud Text-to-Speech API
- **Hosting**: Netlify (conectado a GitHub para auto-deploy)

La API key de Google se guarda de manera segura en las variables de entorno de Netlify y nunca se expone al público.

## Mantenimiento

Para actualizar la aplicación:
1. Modifica los archivos localmente
2. Haz commit y push a GitHub
3. Netlify automáticamente detectará los cambios y actualizará el sitio

No hay necesidad de hacer deploy manual ni de tocar ninguna configuración después de la instalación inicial.
