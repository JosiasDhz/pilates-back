/**
 * Template para confirmación de registro de valoración
 * 
 * IMPORTANTE: Esta plantilla debe estar creada y aprobada en WhatsApp Business Manager
 * 
 * Estructura esperada de la plantilla:
 * Nombre: registro_valoracion
 * Idioma: es (Español)
 * 
 * Cuerpo del mensaje:
 * "¡Hola {{1}}! 👋
 * 
 * ✅ Tu registro de valoración ha sido confirmado:
 * 
 * 📅 Fecha: {{2}}
 * 🕐 Hora: {{3}}
 * 📍 Estudio: {{4}}
 * 
 * Te esperamos en tu clase de valoración. Si tienes alguna pregunta, no dudes en contactarnos.
 * 
 * ¡Nos vemos pronto! 🧘‍♀️"
 * 
 * Parámetros:
 * 1. Nombre del aspirante
 * 2. Fecha formateada
 * 3. Hora
 * 4. Nombre del estudio
 */
export const aspirantRegisterTemplate = (
  firstName: string,
  fecha: string,
  hora: string,
  estudio: string,
) => {
  return {
    template: {
      name: 'registro_valoracion',
      language: {
        code: 'es',
      },
      components: [
        {
          type: 'body',
          parameters: [
            {
              type: 'text',
              text: firstName,
            },
            {
              type: 'text',
              text: fecha,
            },
            {
              type: 'text',
              text: hora,
            },
            {
              type: 'text',
              text: estudio,
            },
          ],
        },
      ],
    },
  };
};
