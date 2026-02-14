// Función de Netlify para Google Cloud Text-to-Speech API
// Versión optimizada para voces Neural2

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Método no permitido' })
        };
    }
    
    try {
        const { text, voiceName } = JSON.parse(event.body);
        
        // Validaciones
        if (!text || text.trim().length === 0) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Texto vacío' })
            };
        }
        
        if (text.length > 2500) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    error: `Máximo 2500 caracteres. Recibido: ${text.length}` 
                })
            };
        }
        
        // Obtener API key
        const apiKey = process.env.GOOGLE_TTS_API_KEY;
        
        if (!apiKey) {
            console.error('API key no configurada');
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Configuración incompleta' })
            };
        }
        
        // Preparar request a Google
        const languageCode = voiceName.substring(0, 5);
        
        const requestBody = {
            input: { text: text },
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
        
        // Timeout controller
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 9000);
        
        let response;
        
        try {
            response = await fetch(
                `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                }
            );
            
            clearTimeout(timeout);
            
        } catch (fetchError) {
            clearTimeout(timeout);
            
            if (fetchError.name === 'AbortError') {
                return {
                    statusCode: 504,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ 
                        error: 'Timeout procesando audio'
                    })
                };
            }
            
            return {
                statusCode: 502,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    error: 'Error de conexión con Google'
                })
            };
        }
        
        if (!response.ok) {
            let errorMessage = 'Error al generar audio';
            
            try {
                const errorData = await response.json();
                if (errorData.error && errorData.error.message) {
                    errorMessage = errorData.error.message;
                }
            } catch (e) {
                // Ignorar errores de parsing
            }
            
            return {
                statusCode: response.status,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: errorMessage })
            };
        }
        
        const data = await response.json();
        
        if (!data.audioContent) {
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'No se recibió audio' })
            };
        }
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                audioContent: data.audioContent,
                characterCount: text.length,
                voiceUsed: voiceName,
                success: true
            })
        };
        
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                error: 'Error interno',
                message: error.message
            })
        };
    }
};
