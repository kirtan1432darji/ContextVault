/**
 * SmartFolderRules.ts
 * Deterministic 5-Tier Classification Pipeline for ContextVault.
 * 
 * 13 Canonical Categories:
 * - finance
 * - shopping
 * - food_delivery
 * - travel
 * - chats
 * - documents
 * - health
 * - education
 * - work
 * - social_media
 * - entertainment
 * - utilities
 * - other
 */

export type CanonicalCategoryId =
  | 'finance'
  | 'shopping'
  | 'food_delivery'
  | 'travel'
  | 'chats'
  | 'documents'
  | 'health'
  | 'education'
  | 'work'
  | 'social_media'
  | 'entertainment'
  | 'utilities'
  | 'other';

export interface CategoryRuleConfig {
  id: CanonicalCategoryId;
  name: string;
  icon: string;
  color: string;
  keywords: { word: string; weight: number }[];
  entities: string[];
  appPackages: string[];
  filenameKeywords: string[];
}

export interface ClassificationRuleResult {
  categoryId: CanonicalCategoryId;
  categoryName: string;
  subcategory: string;
  folderHierarchy: string[];
  confidence: number;
  matchedTier: 'vision' | 'entity' | 'ocr' | 'app' | 'filename' | 'fallback';
  matchedRuleOrEntity?: string;
  suggestedIcon: string;
  suggestedColor: string;
}

export interface ClassificationRuleInput {
  screenshotId?: string;
  fileName?: string;
  ocrText?: string;
  sourceApp?: string;
  detectedApp?: string;
  deviceFolder?: string;
  visionMetadata?: {
    category?: string;
    screen_type?: string;
    confidence?: number;
    entities?: Record<string, any>;
    summary?: string;
    application_name?: string;
  };
}

export const CANONICAL_CATEGORIES: Record<CanonicalCategoryId, CategoryRuleConfig> = {
  finance: {
    id: 'finance',
    name: 'Finance',
    icon: 'wallet-outline',
    color: '#10B981',
    keywords: [
      { word: 'payment successful', weight: 3 },
      { word: 'paid to', weight: 3 },
      { word: 'received from', weight: 3 },
      { word: 'upi', weight: 2 },
      { word: 'transaction', weight: 2 },
      { word: 'transfer', weight: 2 },
      { word: 'credited', weight: 2 },
      { word: 'debited', weight: 2 },
      { word: 'bank', weight: 1 },
      { word: 'neft', weight: 2 },
      { word: 'rtgs', weight: 2 },
      { word: 'imps', weight: 2 },
      { word: 'debit card', weight: 2 },
      { word: 'credit card', weight: 2 },
      { word: 'account balance', weight: 2 },
      { word: 'statement', weight: 1 },
      { word: 'utr', weight: 2 },
      { word: 'txn id', weight: 2 },
      { word: 'invoice', weight: 1 },
      { word: 'gstin', weight: 2 },
      { word: 'rupees', weight: 1 },
      { word: 'amount paid', weight: 2 },
      { word: 'wallet balance', weight: 2 },
      { word: 'cashback', weight: 1 },
    ],
    entities: [
      'PhonePe', 'Google Pay', 'GPay', 'Paytm', 'BHIM', 'Razorpay', 'CRED',
      'HDFC', 'SBI', 'ICICI', 'Axis', 'Kotak', 'IndusInd', 'PNB', 'Bank of Baroda',
      'BOB', 'Canara', 'Yes Bank', 'IDFC First', 'Slice', 'Uni', 'Jupiter', 'Fi Money',
    ],
    appPackages: [
      'com.phonepe.app',
      'com.google.android.apps.nbu.paisa.user',
      'net.one97.paytm',
      'in.org.npci.upiapp',
      'com.dreamplug.androidapp',
      'com.snapwork.hdfc',
      'com.sbi.lotusintouch',
      'com.csam.icici.bank.imobile',
      'com.axis.mobile',
      'com.msf.kbank.mobile',
    ],
    filenameKeywords: ['upi', 'payment', 'phonepe', 'gpay', 'paytm', 'bhim', 'invoice', 'receipt', 'bank', 'statement'],
  },

  shopping: {
    id: 'shopping',
    name: 'Shopping',
    icon: 'bag-handle-outline',
    color: '#F97316',
    keywords: [
      { word: 'order placed', weight: 3 },
      { word: 'order confirmed', weight: 3 },
      { word: 'out for delivery', weight: 3 },
      { word: 'order delivered', weight: 2 },
      { word: 'shipped', weight: 2 },
      { word: 'buy now', weight: 2 },
      { word: 'add to cart', weight: 2 },
      { word: 'wishlist', weight: 1 },
      { word: 'track package', weight: 2 },
      { word: 'order id', weight: 2 },
      { word: 'item total', weight: 2 },
      { word: 'return item', weight: 2 },
      { word: 'dispatch', weight: 1 },
      { word: 'shipment', weight: 2 },
      { word: 'delivery expected', weight: 2 },
      { word: 'order summary', weight: 2 },
    ],
    entities: [
      'Amazon', 'Flipkart', 'Myntra', 'Meesho', 'Ajio', 'Tata CLiQ', 'Nykaa',
      'Purplle', 'Zara', 'H&M', 'Nike', 'Adidas', 'Puma', 'Uniqlo', 'Lenskart',
      'Boat', 'Noise', 'Croma', 'Reliance Digital',
    ],
    appPackages: [
      'com.amazon.mShop.android.shopping',
      'in.amazon.mShop.android.shopping',
      'com.flipkart.android',
      'com.myntra.android',
      'com.meesho.supply',
      'com.ril.ajio',
      'com.fsn.nykaa',
      'com.lenskart.app',
    ],
    filenameKeywords: ['amazon', 'flipkart', 'myntra', 'order', 'shipment', 'tracking', 'meesho', 'ajio', 'shopping'],
  },

  food_delivery: {
    id: 'food_delivery',
    name: 'Food Delivery',
    icon: 'fast-food-outline',
    color: '#EF4444',
    keywords: [
      { word: 'food preparation', weight: 3 },
      { word: 'order delivered', weight: 2 },
      { word: 'delivering to', weight: 2 },
      { word: 'delivery partner', weight: 2 },
      { word: 'restaurant', weight: 2 },
      { word: 'dish', weight: 1 },
      { word: 'menu', weight: 1 },
      { word: 'delivery tip', weight: 2 },
      { word: 'cooking', weight: 1 },
      { word: 'restaurant charges', weight: 2 },
      { word: 'item total', weight: 1 },
      { word: 'food order', weight: 2 },
    ],
    entities: [
      'Swiggy', 'Zomato', 'Blinkit', 'Zepto', 'Dunzo', 'Instamart', "Domino's",
      "McDonald's", 'KFC', 'Starbucks', 'Burger King', 'Pizza Hut', 'Subway',
      'Haldiram', 'Eatfit', 'Behrouz Biryani',
    ],
    appPackages: [
      'in.swiggy.android',
      'com.application.zomato',
      'com.grofers.customerapp',
      'com.zepto.customer',
      'com.dunzo.user',
    ],
    filenameKeywords: ['swiggy', 'zomato', 'blinkit', 'zepto', 'dunzo', 'food', 'restaurant', 'meal', 'instamart'],
  },

  travel: {
    id: 'travel',
    name: 'Travel',
    icon: 'airplane-outline',
    color: '#06B6D4',
    keywords: [
      { word: 'boarding pass', weight: 3 },
      { word: 'train ticket', weight: 3 },
      { word: 'flight ticket', weight: 3 },
      { word: 'pnr', weight: 3 },
      { word: 'seat no', weight: 2 },
      { word: 'terminal', weight: 2 },
      { word: 'gate', weight: 1 },
      { word: 'departure', weight: 2 },
      { word: 'arrival', weight: 2 },
      { word: 'hotel booking', weight: 2 },
      { word: 'itinerary', weight: 2 },
      { word: 'coach', weight: 2 },
      { word: 'berth', weight: 2 },
      { word: 'train no', weight: 2 },
      { word: 'flight no', weight: 2 },
      { word: 'check-in', weight: 1 },
      { word: 'reservation', weight: 2 },
    ],
    entities: [
      'IRCTC', 'IndiGo', 'Air India', 'Vistara', 'SpiceJet', 'Akasa Air',
      'MakeMyTrip', 'ClearTrip', 'Goibibo', 'Booking.com', 'Agoda', 'Uber',
      'Ola', 'Rapido', 'Yatra', 'EaseMyTrip',
    ],
    appPackages: [
      'cris.org.in.prs.ima',
      'in.goindigo.android',
      'com.airindia',
      'in.gov.irctc',
      'com.makemytrip',
      'com.goibibo',
      'com.ubercab',
      'com.olacabs.customer',
      'com.rapido.passenger',
    ],
    filenameKeywords: ['irctc', 'ticket', 'flight', 'boarding', 'pnr', 'hotel', 'booking', 'uber', 'ola', 'travel'],
  },

  chats: {
    id: 'chats',
    name: 'Chats',
    icon: 'chatbubble-ellipses-outline',
    color: '#22C55E',
    keywords: [
      { word: 'typing...', weight: 3 },
      { word: 'last seen', weight: 3 },
      { word: 'group chat', weight: 2 },
      { word: 'voice call', weight: 2 },
      { word: 'video call', weight: 2 },
      { word: 'unread messages', weight: 2 },
      { word: 'online', weight: 1 },
      { word: 'message', weight: 1 },
      { word: 'forwarded', weight: 2 },
      { word: 'read receipt', weight: 2 },
      { word: 'voice note', weight: 2 },
      { word: 'chat history', weight: 2 },
    ],
    entities: ['WhatsApp', 'Telegram', 'Signal', 'Messenger', 'Discord', 'WeChat', 'Viber', 'Truecaller'],
    appPackages: [
      'com.whatsapp',
      'com.whatsapp.w4b',
      'org.telegram.messenger',
      'org.thoughtcrime.securesms',
      'com.facebook.orca',
      'com.discord',
      'com.truecaller',
    ],
    filenameKeywords: ['whatsapp', 'telegram', 'chat', 'signal', 'conversation', 'messenger'],
  },

  documents: {
    id: 'documents',
    name: 'Documents',
    icon: 'document-text-outline',
    color: '#F59E0B',
    keywords: [
      { word: 'government of india', weight: 3 },
      { word: 'income tax department', weight: 3 },
      { word: 'aadhaar', weight: 3 },
      { word: 'pan card', weight: 3 },
      { word: 'passport', weight: 3 },
      { word: 'driving license', weight: 3 },
      { word: 'driving licence', weight: 3 },
      { word: 'voter id', weight: 3 },
      { word: 'certificate', weight: 2 },
      { word: 'contract', weight: 2 },
      { word: 'affidavit', weight: 2 },
      { word: 'agreement', weight: 2 },
      { word: 'vehicle registration', weight: 2 },
      { word: 'rc book', weight: 2 },
      { word: 'stamp paper', weight: 2 },
      { word: 'identity card', weight: 2 },
    ],
    entities: ['Aadhaar', 'Income Tax Department', 'UIDAI', 'Passport Seva', 'Parivahan', 'DigiLocker', 'Election Commission'],
    appPackages: [
      'com.digilocker.android',
      'in.gov.uidai.mAadhaarPlus',
      'nic.hp.echallan',
    ],
    filenameKeywords: ['aadhaar', 'pan', 'passport', 'license', 'licence', 'certificate', 'doc', 'contract', 'agreement'],
  },

  health: {
    id: 'health',
    name: 'Health',
    icon: 'medkit-outline',
    color: '#14B8A6',
    keywords: [
      { word: 'prescription', weight: 3 },
      { word: 'blood test', weight: 3 },
      { word: 'lab report', weight: 3 },
      { word: 'doctor', weight: 2 },
      { word: 'hospital', weight: 2 },
      { word: 'clinic', weight: 2 },
      { word: 'pharmacy', weight: 2 },
      { word: 'medicine', weight: 2 },
      { word: 'tablet', weight: 1 },
      { word: 'syrup', weight: 1 },
      { word: 'dosage', weight: 2 },
      { word: 'diagnosis', weight: 2 },
      { word: 'patient name', weight: 2 },
      { word: 'doctor name', weight: 2 },
      { word: 'blood pressure', weight: 2 },
      { word: 'radiology', weight: 2 },
    ],
    entities: ['Apollo', '1mg', 'PharmEasy', 'Netmeds', 'Tata 1mg', 'Practo', 'Dr Lal PathLabs', 'Metropolis', 'Max Healthcare', 'Fortis', 'MedPlus'],
    appPackages: [
      'com.apollo.patientapp',
      'com.aranoah.healthkart.plus',
      'com.pharmeasy',
      'com.NetmedsMarketplace.Netmeds',
      'com.practo.fabric',
    ],
    filenameKeywords: ['prescription', 'medical', 'doctor', 'lab', 'report', 'medicine', 'hospital', 'rx', 'health'],
  },

  education: {
    id: 'education',
    name: 'Education',
    icon: 'school-outline',
    color: '#3B82F6',
    keywords: [
      { word: 'lecture notes', weight: 3 },
      { word: 'question paper', weight: 3 },
      { word: 'syllabus', weight: 2 },
      { word: 'course', weight: 1 },
      { word: 'tutorial', weight: 1 },
      { word: 'assignment', weight: 2 },
      { word: 'exam', weight: 2 },
      { word: 'quiz', weight: 2 },
      { word: 'classroom', weight: 2 },
      { word: 'study', weight: 1 },
      { word: 'textbook', weight: 2 },
      { word: 'chapter', weight: 1 },
      { word: 'curriculum', weight: 2 },
      { word: 'homework', weight: 2 },
    ],
    entities: ['Coursera', 'Udemy', 'edX', 'Khan Academy', 'Google Classroom', 'Unacademy', "BYJU'S", 'Physics Wallah', 'Duolingo', 'Chegg', 'Quizlet'],
    appPackages: [
      'org.coursera.android',
      'com.udemy.android',
      'org.khanacademy.android',
      'com.google.android.apps.classroom',
      'com.unacademyapp',
      'com.byjus.thelearningapp',
    ],
    filenameKeywords: ['notes', 'study', 'lecture', 'assignment', 'course', 'exam', 'tutorial', 'syllabus'],
  },

  work: {
    id: 'work',
    name: 'Work',
    icon: 'briefcase-outline',
    color: '#6366F1',
    keywords: [
      { word: 'pull request', weight: 3 },
      { word: 'merge request', weight: 3 },
      { word: 'sprint backlog', weight: 3 },
      { word: 'standup meeting', weight: 3 },
      { word: 'slack', weight: 2 },
      { word: 'jira', weight: 2 },
      { word: 'confluence', weight: 2 },
      { word: 'trello', weight: 2 },
      { word: 'asana', weight: 2 },
      { word: 'commit', weight: 1 },
      { word: 'meeting', weight: 1 },
      { word: 'zoom', weight: 1 },
      { word: 'google meet', weight: 2 },
      { word: 'outlook', weight: 1 },
      { word: 'ticket', weight: 1 },
      { word: 'corporate', weight: 1 },
      { word: 'payslip', weight: 2 },
      { word: 'timesheet', weight: 2 },
    ],
    entities: ['Slack', 'Teams', 'Jira', 'GitHub', 'GitLab', 'Trello', 'Asana', 'Zoom', 'Google Meet', 'Outlook', 'Notion', 'Linear', 'Figma', 'ClickUp'],
    appPackages: [
      'com.Slack',
      'com.microsoft.teams',
      'com.atlassian.jira.mobile',
      'com.github.android',
      'com.trello',
      'com.asana.app',
      'us.zoom.videomeetings',
      'com.microsoft.office.outlook',
    ],
    filenameKeywords: ['slack', 'jira', 'sprint', 'meeting', 'project', 'work', 'teams', 'github', 'standup'],
  },

  social_media: {
    id: 'social_media',
    name: 'Social Media',
    icon: 'share-social-outline',
    color: '#EC4899',
    keywords: [
      { word: 'reel', weight: 2 },
      { word: 'story', weight: 1 },
      { word: 'followers', weight: 2 },
      { word: 'following', weight: 2 },
      { word: 'retweet', weight: 3 },
      { word: 'tweet', weight: 2 },
      { word: 'subreddit', weight: 3 },
      { word: 'upvote', weight: 2 },
      { word: 'post', weight: 1 },
      { word: 'explore feed', weight: 2 },
      { word: 'share post', weight: 2 },
    ],
    entities: ['Instagram', 'Facebook', 'Twitter', 'X', 'Reddit', 'LinkedIn', 'Snapchat', 'Pinterest', 'Threads', 'TikTok'],
    appPackages: [
      'com.instagram.android',
      'com.facebook.katana',
      'com.twitter.android',
      'com.reddit.frontpage',
      'com.linkedin.android',
      'com.snapchat.android',
      'com.pinterest',
    ],
    filenameKeywords: ['instagram', 'facebook', 'twitter', 'reddit', 'reel', 'story', 'post', 'tweet', 'snapchat'],
  },

  entertainment: {
    id: 'entertainment',
    name: 'Entertainment',
    icon: 'play-circle-outline',
    color: '#A855F7',
    keywords: [
      { word: 'youtube', weight: 2 },
      { word: 'netflix', weight: 2 },
      { word: 'spotify', weight: 2 },
      { word: 'movie', weight: 1 },
      { word: 'song', weight: 1 },
      { word: 'music', weight: 1 },
      { word: 'podcast', weight: 2 },
      { word: 'episode', weight: 2 },
      { word: 'series', weight: 1 },
      { word: 'trailer', weight: 2 },
      { word: 'gaming', weight: 1 },
      { word: 'season', weight: 1 },
      { word: 'soundtrack', weight: 2 },
    ],
    entities: ['YouTube', 'Netflix', 'Spotify', 'Prime Video', 'Hotstar', 'Disney+', 'Twitch', 'Apple Music', 'JioCinema', 'SonyLIV', 'Zee5', 'Gaana'],
    appPackages: [
      'com.google.android.youtube',
      'com.netflix.mediaclient',
      'com.spotify.music',
      'com.amazon.avod.thirdpartyclient',
      'in.startv.hotstar',
      'tv.twitch.android.app',
    ],
    filenameKeywords: ['youtube', 'netflix', 'spotify', 'movie', 'song', 'music', 'game', 'podcast'],
  },

  utilities: {
    id: 'utilities',
    name: 'Utilities',
    icon: 'flash-outline',
    color: '#EAB308',
    keywords: [
      { word: 'one time password', weight: 3 },
      { word: 'verification code', weight: 3 },
      { word: 'do not share', weight: 2 },
      { word: 'otp', weight: 2 },
      { word: 'electricity bill', weight: 3 },
      { word: 'water bill', weight: 3 },
      { word: 'gas bill', weight: 3 },
      { word: 'mobile recharge', weight: 2 },
      { word: 'recharge successful', weight: 3 },
      { word: 'broadband', weight: 2 },
      { word: 'wifi', weight: 1 },
      { word: 'fastag', weight: 3 },
      { word: 'meter reading', weight: 2 },
      { word: 'consumer no', weight: 2 },
      { word: 'bill amount', weight: 2 },
      { word: 'due date', weight: 1 },
    ],
    entities: ['Airtel', 'Jio', 'Vi', 'Vodafone Idea', 'BESCOM', 'Adani Electricity', 'Tata Power', 'Mahanagar Gas', 'FASTag', 'BSNL', 'ACT Fibernet'],
    appPackages: [
      'com.myairtelapp',
      'com.jio.myjio',
      'com.mizmowired.vi',
    ],
    filenameKeywords: ['otp', 'bill', 'recharge', 'electricity', 'water', 'gas', 'fastag', 'utility'],
  },

  other: {
    id: 'other',
    name: 'Other',
    icon: 'help-circle-outline',
    color: '#94A3B8',
    keywords: [],
    entities: [],
    appPackages: ['com.google.android.apps.photos'],
    filenameKeywords: [],
  },
};

export class SmartFolderRules {
  /**
   * Deterministic 5-Tier Rule Matcher:
   * Tier 1: Vision AI metadata
   * Tier 2: Extracted entity matching
   * Tier 3: OCR keyword frequency & weight scoring
   * Tier 4: Android App Package / detected app signatures
   * Tier 5: Filename heuristics
   * Fallback: Other (0.50)
   */
  static evaluateRules(input: ClassificationRuleInput): ClassificationRuleResult {
    const rawOcr = (input.ocrText || '').toLowerCase();
    const fileName = (input.fileName || '').toLowerCase();
    const sourceApp = (input.sourceApp || '').toLowerCase();
    const detectedApp = (input.detectedApp || '').toLowerCase();
    const deviceFolder = (input.deviceFolder || '').toLowerCase();
    const combinedApp = `${sourceApp} ${detectedApp} ${deviceFolder}`.trim();

    // -------------------------------------------------------------------------
    // Tier 1: Vision AI Classification
    // -------------------------------------------------------------------------
    if (input.visionMetadata) {
      const vm = input.visionMetadata;
      const rawCat = (vm.category || vm.screen_type || '').toLowerCase();
      const summary = (vm.summary || '').toLowerCase();

      const mappedCat = this.mapVisionCategory(rawCat, summary);
      if (mappedCat && mappedCat !== 'other') {
        const cfg = CANONICAL_CATEGORIES[mappedCat];
        const sub = vm.application_name || (vm.entities?.merchant as string) || 'General';
        const rawConf = Number(vm.confidence ?? 0.9);
        const weightedConf = Math.min(0.98, Math.max(0.85, rawConf > 1 ? rawConf / 100 : rawConf));

        return {
          categoryId: mappedCat,
          categoryName: cfg.name,
          subcategory: sub,
          folderHierarchy: [cfg.name, sub].filter(Boolean),
          confidence: weightedConf,
          matchedTier: 'vision',
          matchedRuleOrEntity: rawCat,
          suggestedIcon: cfg.icon,
          suggestedColor: cfg.color,
        };
      }
    }

    // -------------------------------------------------------------------------
    // Tier 2: Entity Matching (Merchants, Platforms, Banks, Airlines, Govt Docs)
    // -------------------------------------------------------------------------
    for (const [catId, cfg] of Object.entries(CANONICAL_CATEGORIES) as [CanonicalCategoryId, CategoryRuleConfig][]) {
      if (catId === 'other') continue;
      for (const ent of cfg.entities) {
        const entLower = ent.toLowerCase();
        const escaped = entLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordRegex = new RegExp(`(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`, 'i');

        // Check if entity appears in Vision entities
        const inVisionEntities = input.visionMetadata?.entities &&
          Object.values(input.visionMetadata.entities).some((v) =>
            typeof v === 'string' && (v.toLowerCase() === entLower || wordRegex.test(v))
          );

        // Check Vision application name
        const inAppName = input.visionMetadata?.application_name &&
          wordRegex.test(input.visionMetadata.application_name);

        // Check OCR text with word boundaries (prevents 'x' in 'Txn', 'uni' in 'Unique')
        const inOcr = rawOcr.length > 0 && wordRegex.test(rawOcr);

        if (inVisionEntities || inAppName || inOcr) {
          return {
            categoryId: catId,
            categoryName: cfg.name,
            subcategory: ent,
            folderHierarchy: [cfg.name, ent],
            confidence: 0.94,
            matchedTier: 'entity',
            matchedRuleOrEntity: ent,
            suggestedIcon: cfg.icon,
            suggestedColor: cfg.color,
          };
        }
      }
    }

    // -------------------------------------------------------------------------
    // Tier 3: OCR Keyword Scoring Dictionary
    // -------------------------------------------------------------------------
    if (rawOcr.length > 0) {
      let topCategory: CanonicalCategoryId = 'other';
      let maxScore = 0;
      let matchedKeyword = '';

      for (const [catId, cfg] of Object.entries(CANONICAL_CATEGORIES) as [CanonicalCategoryId, CategoryRuleConfig][]) {
        if (catId === 'other') continue;
        let score = 0;
        let bestKw = '';

        for (const kw of cfg.keywords) {
          if (rawOcr.includes(kw.word)) {
            score += kw.weight;
            if (!bestKw) bestKw = kw.word;
          }
        }

        if (score > maxScore) {
          maxScore = score;
          topCategory = catId;
          matchedKeyword = bestKw;
        }
      }

      if (maxScore >= 2) {
        const cfg = CANONICAL_CATEGORIES[topCategory];
        const confidence = Math.min(0.92, 0.72 + maxScore * 0.04);
        return {
          categoryId: topCategory,
          categoryName: cfg.name,
          subcategory: 'General',
          folderHierarchy: [cfg.name, 'General'],
          confidence,
          matchedTier: 'ocr',
          matchedRuleOrEntity: matchedKeyword,
          suggestedIcon: cfg.icon,
          suggestedColor: cfg.color,
        };
      }
    }

    // -------------------------------------------------------------------------
    // Tier 4: Android App Signature
    // -------------------------------------------------------------------------
    if (combinedApp.length > 0) {
      for (const [catId, cfg] of Object.entries(CANONICAL_CATEGORIES) as [CanonicalCategoryId, CategoryRuleConfig][]) {
        for (const pkg of cfg.appPackages) {
          if (combinedApp.includes(pkg.toLowerCase())) {
            const sub = cfg.entities[0] || 'General';
            return {
              categoryId: catId,
              categoryName: cfg.name,
              subcategory: sub,
              folderHierarchy: [cfg.name, sub],
              confidence: 0.90,
              matchedTier: 'app',
              matchedRuleOrEntity: pkg,
              suggestedIcon: cfg.icon,
              suggestedColor: cfg.color,
            };
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // Tier 5: Filename Heuristics
    // -------------------------------------------------------------------------
    if (fileName.length > 0) {
      for (const [catId, cfg] of Object.entries(CANONICAL_CATEGORIES) as [CanonicalCategoryId, CategoryRuleConfig][]) {
        if (catId === 'other') continue;
        for (const fnKw of cfg.filenameKeywords) {
          if (fileName.includes(fnKw)) {
            return {
              categoryId: catId,
              categoryName: cfg.name,
              subcategory: 'General',
              folderHierarchy: [cfg.name],
              confidence: 0.75,
              matchedTier: 'filename',
              matchedRuleOrEntity: fnKw,
              suggestedIcon: cfg.icon,
              suggestedColor: cfg.color,
            };
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // Fallback: Other
    // -------------------------------------------------------------------------
    const fallback = CANONICAL_CATEGORIES.other;
    return {
      categoryId: 'other',
      categoryName: fallback.name,
      subcategory: 'General',
      folderHierarchy: [fallback.name],
      confidence: 0.50,
      matchedTier: 'fallback',
      suggestedIcon: fallback.icon,
      suggestedColor: fallback.color,
    };
  }

  /**
   * Helper to map Vision AI raw labels to canonical category IDs.
   */
  private static mapVisionCategory(rawCat: string, summary: string): CanonicalCategoryId | null {
    const combined = `${rawCat} ${summary}`.toLowerCase();

    if (
      combined.includes('finance') ||
      combined.includes('payment') ||
      combined.includes('upi') ||
      combined.includes('bank') ||
      combined.includes('wallet') ||
      combined.includes('invoice') ||
      combined.includes('statement')
    ) {
      return 'finance';
    }

    if (
      combined.includes('food') ||
      combined.includes('delivery') ||
      combined.includes('restaurant') ||
      combined.includes('swiggy') ||
      combined.includes('zomato') ||
      combined.includes('meal') ||
      combined.includes('dish')
    ) {
      return 'food_delivery';
    }

    if (
      combined.includes('shop') ||
      combined.includes('order') ||
      combined.includes('cart') ||
      combined.includes('ecommerce') ||
      combined.includes('amazon') ||
      combined.includes('flipkart') ||
      combined.includes('myntra')
    ) {
      return 'shopping';
    }

    if (
      combined.includes('travel') ||
      combined.includes('flight') ||
      combined.includes('train') ||
      combined.includes('ticket') ||
      combined.includes('boarding') ||
      combined.includes('irctc') ||
      combined.includes('pnr') ||
      combined.includes('hotel')
    ) {
      return 'travel';
    }

    if (
      combined.includes('chat') ||
      combined.includes('message') ||
      combined.includes('whatsapp') ||
      combined.includes('telegram') ||
      combined.includes('conversation')
    ) {
      return 'chats';
    }

    if (
      combined.includes('document') ||
      combined.includes('aadhaar') ||
      combined.includes('pan card') ||
      combined.includes('passport') ||
      combined.includes('license') ||
      combined.includes('certificate') ||
      combined.includes('contract') ||
      combined.includes('id card')
    ) {
      return 'documents';
    }

    if (
      combined.includes('health') ||
      combined.includes('medical') ||
      combined.includes('prescription') ||
      combined.includes('doctor') ||
      combined.includes('hospital') ||
      combined.includes('medicine') ||
      combined.includes('clinic')
    ) {
      return 'health';
    }

    if (
      combined.includes('education') ||
      combined.includes('study') ||
      combined.includes('learning') ||
      combined.includes('course') ||
      combined.includes('lecture') ||
      combined.includes('notes') ||
      combined.includes('assignment')
    ) {
      return 'education';
    }

    if (
      combined.includes('work') ||
      combined.includes('slack') ||
      combined.includes('jira') ||
      combined.includes('github') ||
      combined.includes('project') ||
      combined.includes('sprint') ||
      combined.includes('code') ||
      combined.includes('corporate')
    ) {
      return 'work';
    }

    if (
      combined.includes('social') ||
      combined.includes('instagram') ||
      combined.includes('twitter') ||
      combined.includes('reddit') ||
      combined.includes('facebook') ||
      combined.includes('post') ||
      combined.includes('reel')
    ) {
      return 'social_media';
    }

    if (
      combined.includes('entertainment') ||
      combined.includes('youtube') ||
      combined.includes('netflix') ||
      combined.includes('spotify') ||
      combined.includes('movie') ||
      combined.includes('music') ||
      combined.includes('song') ||
      combined.includes('game')
    ) {
      return 'entertainment';
    }

    if (
      combined.includes('utility') ||
      combined.includes('utilities') ||
      combined.includes('bill') ||
      combined.includes('otp') ||
      combined.includes('electricity') ||
      combined.includes('water') ||
      combined.includes('recharge') ||
      combined.includes('fastag')
    ) {
      return 'utilities';
    }

    return null;
  }
}
