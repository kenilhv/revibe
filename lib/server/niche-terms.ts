import "server-only";

// Exact search phrases per niche and language for the Oriane API. The API matches words and does not
// translate, so a market scan needs terms in that market's language. These lists cover the niches on
// the Input screen's quick picks. Other niches fall back to the model's translation in the scan route.
// Verified today: exact phrases with these Japanese terms returned 100/100 on-topic energy drink videos;
// fuzzy matching returned 56/100 in English.

const NICHE_TERMS: Record<string, Record<string, string[]>> = {
  "energy drink": {
    en: ["energy drink", "red bull", "monster energy", "celsius", "ghost energy", "alani", "prime energy"],
    ja: ["エナドリ", "エナジードリンク", "レッドブル", "モンスターエナジー", "モンエナ", "ZONe", "RAIZIN"],
    es: ["bebida energética", "red bull", "monster energy"],
    pt: ["energético", "red bull", "monster energy"],
    hi: ["energy drink", "एनर्जी ड्रिंक", "red bull", "sting"],
    ko: ["에너지드링크", "에너지 드링크", "몬스터", "레드불", "핫식스"],
    fr: ["boisson énergisante", "red bull", "monster energy"],
    de: ["energy drink", "energydrink", "red bull", "monster energy"],
    id: ["minuman energi", "energy drink", "kratingdaeng", "red bull"],
  },
  skincare: {
    en: ["skincare", "skin care", "serum", "moisturizer", "sunscreen", "retinol"],
    ja: ["スキンケア", "美容液", "化粧水", "日焼け止め", "乳液"],
    ko: ["스킨케어", "세럼", "선크림", "토너"],
    es: ["skincare", "cuidado de la piel", "sérum", "protector solar"],
    pt: ["skincare", "cuidados com a pele", "sérum", "protetor solar"],
    hi: ["skincare", "स्किन केयर", "sunscreen", "serum"],
    fr: ["skincare", "soin de la peau", "sérum", "crème solaire"],
    de: ["skincare", "hautpflege", "serum", "sonnencreme"],
    id: ["skincare", "perawatan kulit", "serum", "sunscreen"],
  },
  "protein snack": {
    en: ["protein bar", "protein snack", "protein chips", "high protein", "protein shake"],
    ja: ["プロテインバー", "プロテイン", "高タンパク", "タンパク質"],
    ko: ["단백질바", "프로틴바", "프로틴", "단백질"],
    es: ["barra de proteína", "proteína", "snack proteico"],
    pt: ["barra de proteína", "proteína", "whey"],
    hi: ["protein bar", "protein", "प्रोटीन"],
    fr: ["barre protéinée", "protéine"],
    de: ["proteinriegel", "protein", "eiweiß"],
    id: ["protein bar", "protein", "camilan protein"],
  },
  "budget travel": {
    en: ["budget travel", "cheap flights", "travel hack", "backpacking", "hostel"],
    ja: ["格安旅行", "節約旅行", "LCC", "一人旅", "ゲストハウス"],
    ko: ["가성비 여행", "저렴한 항공권", "배낭여행", "호스텔"],
    es: ["viajar barato", "vuelos baratos", "mochilero", "hostal"],
    pt: ["viajar barato", "passagens baratas", "mochilão", "hostel"],
    hi: ["budget travel", "सस्ती यात्रा", "cheap flights", "backpacking"],
    fr: ["voyager pas cher", "vols pas chers", "backpacking", "auberge de jeunesse"],
    de: ["günstig reisen", "billige flüge", "backpacking", "hostel"],
    id: ["liburan hemat", "tiket murah", "backpacker", "hostel"],
  },
  coffee: {
    en: ["coffee", "latte", "espresso", "cold brew", "matcha latte"],
    ja: ["コーヒー", "カフェラテ", "エスプレッソ", "カフェ", "抹茶ラテ"],
    ko: ["커피", "라떼", "에스프레소", "카페"],
    es: ["café", "latte", "espresso"],
    pt: ["café", "latte", "espresso"],
    hi: ["coffee", "कॉफी", "latte"],
    fr: ["café", "latte", "expresso"],
    de: ["kaffee", "latte", "espresso"],
    id: ["kopi", "latte", "espresso", "kopi susu"],
  },
};

/** Known exact phrases for a niche in a language, or null when ReVibe has no list for it. */
export function knownNicheTerms(niche: string, language: string): string[] | null {
  const byLang = NICHE_TERMS[niche.trim().toLowerCase().replace(/\s+/g, " ")];
  const list = byLang?.[language.toLowerCase().slice(0, 2)];
  return list && list.length > 0 ? [...list] : null;
}
