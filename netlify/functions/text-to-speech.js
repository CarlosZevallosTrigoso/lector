// ============================================
// FUNCIÓN DE NETLIFY - AZURE TEXT-TO-SPEECH
// ============================================

const sdk = require('microsoft-cognitiveservices-speech-sdk');

exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    
    // Validar método HTTP
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ error: 'Método no permitido. Usa POST.' })
        };
    }
    
    try {
        // Parsear datos
        const { text, voiceName } = JSON.parse(event.body);
        
        // Validaciones
        if (!text || text.trim().length === 0) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'El texto no puede estar vacío' })
            };
        }
        
        if (text.length > 2000) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    error: `Máximo 2000 caracteres por fragmento. Recibido: ${text.length}`,
                    charCount: text.length
                })
            };
        }
        
        // Obtener credenciales de Azure
        const speechKey = process.env.AZURE_SPEECH_KEY;
        const speechRegion = process.env.AZURE_REGION;
        
        if (!speechKey || !speechRegion) {
            console.error('Credenciales de Azure no configuradas');
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    error: 'Configuración del servidor incompleta',
                    hint: 'Variables AZURE_SPEECH_KEY o AZURE_REGION no encontradas'
                })
            };
        }
        
        // Configurar Azure Speech SDK
        const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
        speechConfig.speechSynthesisVoiceName = voiceName;
        speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
        
        // Crear sintetizador
        const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);
        
        // Generar audio
        return new Promise((resolve, reject) => {
            synthesizer.speakTextAsync(
                text,
                result => {
                    synthesizer.close();
                    
                    if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                        // Convertir audio a base64
                        const audioData = result.audioData;
                        const base64Audio = Buffer.from(audioData).toString('base64');
                        
                        resolve({
                            statusCode: 200,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*',
                                'Cache-Control': 'no-cache'
                            },
                            body: JSON.stringify({
                                audioContent: base64Audio,
                                characterCount: text.length,
                                voiceUsed: voiceName,
                                success: true
                            })
                        });
                    } else {
                        console.error('Error de síntesis:', result.errorDetails);
                        resolve({
                            statusCode: 500,
                            headers: {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*'
                            },
                            body: JSON.stringify({
                                error: 'Error al sintetizar audio',
                                details: result.errorDetails
                            })
                        });
                    }
                },
                error => {
                    synthesizer.close();
                    console.error('Error:', error);
                    resolve({
                        statusCode: 500,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            error: 'Error al generar audio',
                            message: error.toString()
                        })
                    });
                }
            );
        });
        
    } catch (error) {
        console.error('Error inesperado:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Error interno del servidor',
                message: error.message
            })
        };
    }
};
