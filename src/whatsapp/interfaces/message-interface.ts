export interface MessageInterface {
  to: string;
  flowId?: string;
  flowCta?: string;
  bodyText?: string;
  template?: any;
  interactive?: {
    type: 'button' | 'cta_url';
    body: {
      text: string;
    };
    footer?: {
      text: string;
    };
    action: {
      buttons?: Array<{
        type: 'reply' | 'url';
        reply?: {
          id: string;
          title: string;
        };
        url?: string;
      }>;
      name?: string;
      parameters?: {
        display_text: string;
        url: string;
      };
    };
  };
}
