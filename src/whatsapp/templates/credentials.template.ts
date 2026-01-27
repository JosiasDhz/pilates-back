/**
 * Template para envío de credenciales de acceso al sistema
 * 
 * IMPORTANTE: Esta plantilla debe estar creada y aprobada en WhatsApp Business Manager
 * 
 * Estructura esperada de la plantilla:
 * Nombre: system_credentials
 * Idioma: es (Español)
 * 
 * Cuerpo del mensaje:
 * "Hola {{1}},
 * 
 * Tus credenciales de acceso al sistema han sido creadas:
 * 
 * 📧 Email: {{2}}
 * 🔑 Contraseña: {{3}}
 * 
 * Puedes acceder en: {{4}}
 * 
 * Te recomendamos cambiar tu contraseña después del primer acceso."
 * 
 * Parámetros:
 * 1. Nombre del usuario
 * 2. Email
 * 3. Contraseña temporal
 * 4. URL de acceso al sistema
 */
export const credentialsTemplate = (
  name: string,
  email: string,
  password: string,
  loginUrl: string,
) => {
  const bodyParams = [
    {
      type: 'text',
      text: name,
    },
    {
      type: 'text',
      text: email,
    },
    {
      type: 'text',
      text: password,
    },
    {
      type: 'text',
      text: loginUrl,
    },
  ];

  return {
    template: {
      name: 'system_credentials',
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
