export const confirmRegisterTemplate = (folio: string) => {
  return {
    template: {
      name: 'confirmar_registro',
      language: {
        code: 'en',
      },
      components: [
        {
          type: 'body',
          parameters: [
            {
              type: 'text',
              text: folio,
            },
          ],
        },
      ],
    },
  };
};
