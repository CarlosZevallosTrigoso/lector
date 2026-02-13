// ============================================
// FUNCIÓN DE NETLIFY - TEXT-TO-SPEECH
// ============================================
// Esta función se ejecuta en los servidores de Netlify
// Actúa como proxy seguro entre tu app y Google Cloud TTS API
// La API key nunca se expone al público

exports.handler = async (event, context) => {
    // Configurar para no esperar eventos pendientes
    context.callbackWaitsForEmptyEventLoop = false;
    
    // ============================================
    // VALIDACIÓN DE MÉTODO HTTP
    // ============================================
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                error: 'Método no permitido. Usa POST.' 
            })
        };
    }
    
    try {
        // ============================================
        // PARSEAR Y VALIDAR DATOS DE ENTRADA
        // ============================================
        const { text, voiceName } = JSON.parse(event.body);
        
        // Validación 1: Texto no vacío
        if (!text || text.trim().length === 0) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    error: 'El texto no puede estar vacío' 
                })
            };
        }
        
        // Validación 2: Tamaño del texto (límite conservador para evitar timeouts)
        // Para voces premium que son más lentas, limitamos a 2000 caracteres por fragmento
        if (text.length > 2000) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    error: `El texto excede el límite. Máximo: 2000 caracteres. Recibido: ${text.length} caracteres.`,
                    charCount: text.length
                })
            };
        }
        
        // Validación 3: Nombre de voz
        if (!voiceName || typeof voiceName !== 'string') {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    error: 'Nombre de voz inválido' 
                })
            };
        }
        
        // ============================================
        // OBTENER API KEY DE GOOGLE CLOUD
        // ============================================
        const apiKey = process.env.GOOGLE_TTS_API_KEY;
        
        if (!apiKey) {
            console.error('ERROR CRÍTICO: API key no configurada en variables de entorno de Netlify');
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    error: 'Configuración del servidor incompleta. Contacta al administrador.',
                    hint: 'Variable GOOGLE_TTS_API_KEY no encontrada'
                })
            };
        }
        
        // ============================================
        // PREPARAR PETICIÓN A GOOGLE CLOUD TTS
        // ============================================
        
        // Extraer código de idioma del nombre de la voz
        // Ejemplo: "es-ES-Neural2-A" -> "es-ES"
        const languageCode = voiceName.substring(0, 5);
        
        // Construir el body de la petición a Google
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
                speakingRate: 1.0,      // Velocidad normal
                pitch: 0.0,              // Tono normal
                volumeGainDb: 0.0,       // Volumen normal
                sampleRateHertz: 24000   // Calidad estándar MP3
            }
        };
        
        // ============================================
        // LLAMAR A GOOGLE CLOUD TTS API CON TIMEOUT
        // ============================================
        
        // Crear controlador de timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
        }, 9000); // 9 segundos - máximo posible en Netlify gratuito (10s límite real)
        
        let response;
        
        try {
            // Hacer la petición a Google Cloud TTS
            response = await fetch(
                `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                }
            );
            
            // Limpiar timeout si la petición completó a tiempo
            clearTimeout(timeout);
            
        } catch (fetchError) {
            // Limpiar timeout
            clearTimeout(timeout);
            
            // Verificar si fue timeout
            if (fetchError.name === 'AbortError') {
                console.error('TIMEOUT: Google API tardó más de 9 segundos');
                return {
                    statusCode: 504,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({ 
                        error: 'Timeout al procesar el audio. Google está tardando demasiado en responder.',
                        hint: 'Intenta con un texto más corto o espera unos minutos.',
                        charCount: text.length
                    })
                };
            }
            
            // Otro tipo de error de red
            console.error('Error de red al llamar a Google API:', fetchError);
            return {
                statusCode: 502,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    error: 'Error de conexión con Google Cloud',
                    message: fetchError.message
                })
            };
        }
        
        // ============================================
        // VERIFICAR RESPUESTA DE GOOGLE
        // ============================================
        
        if (!response.ok) {
            // Intentar obtener detalles del error
            let errorDetails = 'Sin detalles disponibles';
            let errorMessage = 'Error al generar audio con Google API';
            
            try {
                const errorText = await response.text();
                errorDetails = errorText;
                
                // Intentar parsear como JSON para obtener mensaje específico
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.error && errorJson.error.message) {
                        errorMessage = errorJson.error.message;
                    }
                } catch (e) {
                    // No es JSON, usar texto plano
                }
                
            } catch (e) {
                console.error('No se pudo leer el cuerpo del error');
            }
            
            console.error(`Google API Error (${response.status}):`, errorDetails);
            
            // Mensajes de error específicos según el código de estado
            let userMessage = errorMessage;
            
            if (response.status === 400) {
                userMessage = 'Petición inválida a Google API. Verifica el texto y la voz seleccionada.';
            } else if (response.status === 401 || response.status === 403) {
                userMessage = 'Error de autenticación con Google API. Verifica la API key.';
            } else if (response.status === 429) {
                userMessage = 'Demasiadas peticiones a Google API. Espera unos segundos e intenta nuevamente.';
            } else if (response.status >= 500) {
                userMessage = 'Google Cloud está experimentando problemas. Intenta nuevamente en unos minutos.';
            }
            
            return {
                statusCode: response.status,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    error: userMessage,
                    details: errorDetails,
                    statusCode: response.status
                })
            };
        }
        
        // ============================================
        // PROCESAR RESPUESTA EXITOSA
        // ============================================
        
        const data = await response.json();
        
        // Verificar que el audioContent existe
        if (!data.audioContent) {
            console.error('Respuesta de Google no contiene audioContent:', data);
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    error: 'Google API no devolvió audio',
                    details: 'El campo audioContent está vacío'
                })
            };
        }
        
        // ============================================
        // DEVOLVER AUDIO AL CLIENTE
        // ============================================
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                audioContent: data.audioContent,  // Base64 MP3
                characterCount: text.length,
                voiceUsed: voiceName,
                success: true
            })
        };
        
    } catch (error) {
        // ============================================
        // MANEJO DE ERRORES GENERALES
        // ============================================
        
        console.error('Error inesperado en la función:', error);
        console.error('Stack trace:', error.stack);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                error: 'Error interno del servidor',
                message: error.message,
                type: error.name
            })
        };
    }
};
