export type VisionPromptDomain =
  | 'shopping'
  | 'banking'
  | 'code'
  | 'meeting'
  | 'chat'
  | 'general';

export class VisionPromptBuilder {
  /**
   * System instruction enforcing strict JSON output conforming to VisionScene.
   */
  private readonly systemInstruction = `You are ContextVault Vision AI, an expert visual screen intelligence agent.
Analyze the provided screenshot image and any accompanying OCR text to output a complete visual scene representation.
You MUST respond with a single valid JSON object strictly matching this schema:
{
  "screenType": "shopping_receipt | payment_confirmation | banking_transaction | code_editor | chat_conversation | social_feed | travel_ticket | food_delivery | document_article | entertainment_media | settings_system | other",
  "application": "Name of the detected application or platform (e.g. Amazon, PhonePe, VS Code, WhatsApp)",
  "summary": "Concise 1-2 sentence description of what this screen visually conveys",
  "objects": ["Array", "of", "detected", "visual", "components", "buttons", "or", "products"],
  "entities": {
    "merchant": "merchant or payee if applicable",
    "amount": "amount with currency symbol if applicable",
    "orderId": "order ID or reference number if applicable",
    "deliveryDate": "delivery or transaction date if applicable",
    "language": "programming language if code screen",
    "error": "error message or stack trace if code screen",
    "participants": "participants if chat/meeting screen"
  },
  "confidence": 0.95,
  "detectedLogos": ["Logos visible on screen"],
  "detectedIcons": ["Key icon elements visible"],
  "colors": ["Dominant brand or UI color tones"],
  "language": "Primary language (e.g. en, hi)"
}
Return ONLY valid JSON. Do not include introductory text or trailing markdown formatting.`;

  /**
   * Domain-specific multimodal prompts.
   */
  private readonly domainInstructions: Record<VisionPromptDomain, string> = {
    shopping:
      'Identify merchant, products, prices, delivery information, and purchase status. Note key interactive elements like Buy Again or Order Details.',
    banking:
      'Identify payment app, amount, merchant/payee, transaction type, reference number, and UPI transaction status.',
    code:
      'Identify programming language, IDE, errors, stack trace, framework, and active file or function context.',
    meeting:
      'Identify meeting platform, participants, agenda, dates, and tasks or calendar schedules.',
    chat:
      'Identify chat platform, participants, conversation summary, dates, action items, and topic of discussion.',
    general:
      'Perform universal visual screen understanding: identify screen type, application, primary content summary, visual objects, entities, and visible brand logos.',
  };

  /**
   * Detects the probable domain from OCR text or file name hint to select the best specialized prompt.
   */
  detectDomain(ocrText?: string, fileName?: string): VisionPromptDomain {
    const text = `${fileName || ''} ${ocrText || ''}`.toLowerCase();

    if (
      text.includes('order') ||
      text.includes('cart') ||
      text.includes('amazon') ||
      text.includes('flipkart') ||
      text.includes('delivery') ||
      text.includes('invoice') ||
      text.includes('receipt')
    ) {
      return 'shopping';
    }

    if (
      text.includes('upi') ||
      text.includes('phonepe') ||
      text.includes('gpay') ||
      text.includes('paytm') ||
      text.includes('transaction') ||
      text.includes('paid to') ||
      text.includes('transferred') ||
      text.includes('bank') ||
      text.includes('utr')
    ) {
      return 'banking';
    }

    if (
      text.includes('vscode') ||
      text.includes('error') ||
      text.includes('exception') ||
      text.includes('import ') ||
      text.includes('const ') ||
      text.includes('function') ||
      text.includes('git') ||
      text.includes('traceback')
    ) {
      return 'code';
    }

    if (
      text.includes('meeting') ||
      text.includes('zoom') ||
      text.includes('google meet') ||
      text.includes('teams') ||
      text.includes('calendar') ||
      text.includes('agenda')
    ) {
      return 'meeting';
    }

    if (
      text.includes('whatsapp') ||
      text.includes('telegram') ||
      text.includes('chat') ||
      text.includes('typing...') ||
      text.includes('online') ||
      text.includes('message')
    ) {
      return 'chat';
    }

    return 'general';
  }

  /**
   * Builds the complete multimodal prompt text.
   */
  buildPrompt(options?: {
    domain?: VisionPromptDomain;
    ocrText?: string;
    fileName?: string;
    modelFamily?: 'gemma_vision' | 'qwen_vl' | 'llama_vision' | 'gemini_vision' | 'heuristic_offline';
  }): { system: string; user: string } {
    const domain =
      options?.domain || this.detectDomain(options?.ocrText, options?.fileName);
    const domainSpecific = this.domainInstructions[domain];

    let userPrompt = `${domainSpecific}\n\nTask: Visually inspect this screenshot and extract structured scene metadata conforming strictly to the JSON schema.`;

    if (options?.ocrText && options.ocrText.trim().length > 0) {
      const truncatedOcr = options.ocrText.trim().substring(0, 800);
      userPrompt += `\n\nExtracted OCR Text context:\n"${truncatedOcr}"`;
    }

    return {
      system: this.systemInstruction,
      user: userPrompt,
    };
  }
}

export const visionPromptBuilder = new VisionPromptBuilder();
