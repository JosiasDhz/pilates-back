export interface ReceivedMessage {
  object: string;
  entry: Entry[];
}

export interface Entry {
  id: string;
  changes: Change[];
}

export interface Change {
  value: Value;
  field: string;
}

export interface Value {
  messaging_product: string;
  metadata: Metadata;
  contacts: Contact[];
  messages: Message[];
}

export interface Contact {
  profile: Profile;
  wa_id: string;
}

export interface Profile {
  name: string;
}

export interface Message {
  context: Context;
  from: string;
  id: string;
  timestamp: string;
  type: string;
  interactive: Interactive;
}

export interface Context {
  from: string;
  id: string;
}

export interface Interactive {
  type: string;
  nfm_reply: NfmReply;
}

export interface NfmReply {
  response_json: string;
  body: string;
  name: string;
}

export interface Metadata {
  display_phone_number: string;
  phone_number_id: string;
}
