/**
 * Template para confirmación de registro de valoración
 * 
 * IMPORTANTE: Esta plantilla debe estar creada y aprobada en WhatsApp Business Manager
 * 
 * Estructura esperada de la plantilla:
 * Nombre: appointment_confirme
 * Idioma: es (Español)
 * 
 * Cuerpo del mensaje:
 * "Hola {{1}},
 * 
 * Su cita está programada para el {{2}}.
 * Hora: {{3}}
 * Estudio: {{4}}
 * 
 * Esperamos su visita."
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
  const bodyParams = [
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
  ];

  return {
    template: {
      name: 'appointment_confirme',
      language: {
        code: 'es',
      },
      components: [
        {
          type: 'body',
          parameters: bodyParams,
        },
      ],
    },
  };
};
