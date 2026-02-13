// Esta función se ejecuta en los servidores de Netlify, no en el navegador del usuario
// Por eso puede acceder de manera segura a la API key sin exponerla

const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    // Solo permitir peticiones POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Método no permitido' })
        };
    }
    
    try {
        // Parsear el cuerpo de la petición que viene desde el frontend
        const { text, voiceName } = JSON.parse(event.body);
        
        // Validaciones básicas
        if (!text || text.trim().length === 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'El texto no puede estar vacío' })
            };
        }
        
        if (text.length > 5000) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'El texto no puede exceder 5000 caracteres por fragmento' })
            };
        }
        
        // Obtener la API key desde las variables de entorno de Netlify
        // Esta variable solo existe en el servidor y nunca se expone al público
        const apiKey = process.env.GOOGLE_TTS_API_KEY;
        
        if (!apiKey) {
            console.error('API key no configurada en las variables de entorno');
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'Configuración del servidor incompleta' })
            };
        }
        
        // Extraer el código de idioma del nombre de la voz
        // Por ejemplo: "es-ES-Neural2-A" -> "es-ES"
        const languageCode = voiceName.substring(0, 5);
        
        // Construir la petición a Google Cloud Text-to-Speech API
        const requestBody = {
            input: {
                text: text
            },
            voice: {
                languageCode: languageCode,
                name: voiceName
            },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: 1.0,
                pitch: 0.0,
                volumeGainDb: 0.0,
                sampleRateHertz: 24000
            }
        };
        
        // Hacer la llamada a la API de Google
        const response = await fetch(
            `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            }
        );
        
        // Verificar si la respuesta fue exitosa
        if (!response.ok) {
            const errorData = await response.text();
            console.error('Error de Google API:', errorData);
            
            return {
                statusCode: response.status,
                body: JSON.stringify({ 
                    error: 'Error al generar audio con Google API',
                    details: errorData 
                })
            };
        }
        
        // Obtener los datos de la respuesta
        const data = await response.json();
        
        // Devolver el audio al frontend
        // El audioContent viene en base64, que es perfecto para enviarlo de vuelta
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                // Permitir que el frontend acceda a esta función
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                audioContent: data.audioContent,
                characterCount: text.length
            })
        };
        
    } catch (error) {
        console.error('Error en la función:', error);
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Error interno del servidor',
                message: error.message 
            })
        };
    }
};
