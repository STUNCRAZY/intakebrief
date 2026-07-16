/** Inquiry intake contracts shared by the form renderer, API, and pipeline. */

export interface BaseInquiry {
  firmId: string;
  fullName: string;
  email: string;
  phone: string;
  preferredContact: 'email' | 'phone';
  message: string;
  /** Must be true — consent to transactional contact about the inquiry. */
  consentTransactional: true;
  /** Must be true — acknowledges no attorney-client relationship is created. */
  acknowledgeNoRelationship: true;
  /** Spam trap; must stay empty for human submissions. */
  honeypot?: string;
  /** Client-supplied key; duplicate submissions with the same key are deduped. */
  idempotencyKey: string;
}

export type FieldType = 'text' | 'email' | 'tel' | 'date' | 'select' | 'textarea' | 'checkbox';

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
}

export type DeliveryStatus = 'accepted' | 'failed' | 'blocked';

export interface InquiryResult {
  firmNotification: { status: DeliveryStatus; detail: string };
  customerResponse: { status: DeliveryStatus; detail: string };
  classification: {
    primary: string | null;
    confidence: 'high' | 'medium' | 'low';
    topics: string[];
  };
}
