export interface Country {
  code: string;
  name: string;
  currency: string;
  /** 検索用の別名 */
  alias?: string;
}

export const COUNTRIES: Country[] = [
  { code: 'KR', name: '韓国', currency: 'KRW', alias: 'かんこく ソウル プサン korea' },
  { code: 'TW', name: '台湾', currency: 'TWD', alias: 'たいわん 台北 taiwan' },
  { code: 'US', name: 'アメリカ', currency: 'USD', alias: 'ハワイ グアム 米国 usa america hawaii guam' },
  { code: 'TH', name: 'タイ', currency: 'THB', alias: 'バンコク thailand' },
  { code: 'FR', name: 'フランス', currency: 'EUR', alias: 'パリ france' },
  { code: 'IT', name: 'イタリア', currency: 'EUR', alias: 'ローマ italy' },
  { code: 'GB', name: 'イギリス', currency: 'GBP', alias: 'ロンドン 英国 uk' },
  { code: 'SG', name: 'シンガポール', currency: 'SGD', alias: 'singapore' },
  { code: 'HK', name: '香港', currency: 'HKD', alias: 'ほんこん hong kong' },
  { code: 'VN', name: 'ベトナム', currency: 'VND', alias: 'ハノイ ホーチミン vietnam' },
  { code: 'AU', name: 'オーストラリア', currency: 'AUD', alias: 'シドニー australia' },
  { code: 'ES', name: 'スペイン', currency: 'EUR', alias: 'バルセロナ spain' },
  { code: 'DE', name: 'ドイツ', currency: 'EUR', alias: 'germany' },
  { code: 'AT', name: 'オーストリア', currency: 'EUR', alias: 'ウィーン austria' },
  { code: 'BE', name: 'ベルギー', currency: 'EUR', alias: 'belgium' },
  { code: 'FI', name: 'フィンランド', currency: 'EUR', alias: 'ヘルシンキ finland' },
  { code: 'GR', name: 'ギリシャ', currency: 'EUR', alias: 'greece' },
  { code: 'IE', name: 'アイルランド', currency: 'EUR', alias: 'ireland' },
  { code: 'NL', name: 'オランダ', currency: 'EUR', alias: 'netherlands' },
  { code: 'PT', name: 'ポルトガル', currency: 'EUR', alias: 'リスボン portugal' },
  { code: 'HR', name: 'クロアチア', currency: 'EUR', alias: 'croatia' },
  { code: 'MT', name: 'マルタ', currency: 'EUR', alias: 'malta' },
  { code: 'LU', name: 'ルクセンブルク', currency: 'EUR', alias: 'luxembourg' },
  { code: 'SI', name: 'スロベニア', currency: 'EUR', alias: 'slovenia' },
  { code: 'SK', name: 'スロバキア', currency: 'EUR', alias: 'slovakia' },
  { code: 'EE', name: 'エストニア', currency: 'EUR', alias: 'estonia' },
  { code: 'LV', name: 'ラトビア', currency: 'EUR', alias: 'latvia' },
  { code: 'LT', name: 'リトアニア', currency: 'EUR', alias: 'lithuania' },
  { code: 'CH', name: 'スイス', currency: 'CHF', alias: 'switzerland' },
  { code: 'SE', name: 'スウェーデン', currency: 'SEK', alias: 'sweden' },
  { code: 'NO', name: 'ノルウェー', currency: 'NOK', alias: 'norway' },
  { code: 'DK', name: 'デンマーク', currency: 'DKK', alias: 'denmark' },
  { code: 'IS', name: 'アイスランド', currency: 'ISK', alias: 'iceland' },
  { code: 'CZ', name: 'チェコ', currency: 'CZK', alias: 'プラハ czech' },
  { code: 'HU', name: 'ハンガリー', currency: 'HUF', alias: 'ブダペスト hungary' },
  { code: 'PL', name: 'ポーランド', currency: 'PLN', alias: 'poland' },
  { code: 'TR', name: 'トルコ', currency: 'TRY', alias: 'イスタンブール turkey' },
  { code: 'CN', name: '中国', currency: 'CNY', alias: 'ちゅうごく 上海 北京 china' },
  { code: 'MO', name: 'マカオ', currency: 'MOP', alias: 'macau' },
  { code: 'MY', name: 'マレーシア', currency: 'MYR', alias: 'malaysia' },
  { code: 'ID', name: 'インドネシア', currency: 'IDR', alias: 'バリ bali indonesia' },
  { code: 'PH', name: 'フィリピン', currency: 'PHP', alias: 'セブ philippines' },
  { code: 'KH', name: 'カンボジア', currency: 'KHR', alias: 'cambodia' },
  { code: 'LA', name: 'ラオス', currency: 'LAK', alias: 'laos' },
  { code: 'MM', name: 'ミャンマー', currency: 'MMK', alias: 'myanmar' },
  { code: 'IN', name: 'インド', currency: 'INR', alias: 'india' },
  { code: 'LK', name: 'スリランカ', currency: 'LKR', alias: 'sri lanka' },
  { code: 'NP', name: 'ネパール', currency: 'NPR', alias: 'nepal' },
  { code: 'MV', name: 'モルディブ', currency: 'MVR', alias: 'maldives' },
  { code: 'MN', name: 'モンゴル', currency: 'MNT', alias: 'mongolia' },
  { code: 'AE', name: 'アラブ首長国連邦', currency: 'AED', alias: 'ドバイ uae dubai' },
  { code: 'QA', name: 'カタール', currency: 'QAR', alias: 'qatar' },
  { code: 'IL', name: 'イスラエル', currency: 'ILS', alias: 'israel' },
  { code: 'JO', name: 'ヨルダン', currency: 'JOD', alias: 'jordan' },
  { code: 'EG', name: 'エジプト', currency: 'EGP', alias: 'egypt' },
  { code: 'MA', name: 'モロッコ', currency: 'MAD', alias: 'morocco' },
  { code: 'ZA', name: '南アフリカ', currency: 'ZAR', alias: 'south africa' },
  { code: 'KE', name: 'ケニア', currency: 'KES', alias: 'kenya' },
  { code: 'CA', name: 'カナダ', currency: 'CAD', alias: 'バンクーバー canada' },
  { code: 'MX', name: 'メキシコ', currency: 'MXN', alias: 'カンクン mexico' },
  { code: 'BR', name: 'ブラジル', currency: 'BRL', alias: 'brazil' },
  { code: 'AR', name: 'アルゼンチン', currency: 'ARS', alias: 'argentina' },
  { code: 'PE', name: 'ペルー', currency: 'PEN', alias: 'マチュピチュ peru' },
  { code: 'CL', name: 'チリ', currency: 'CLP', alias: 'chile' },
  { code: 'NZ', name: 'ニュージーランド', currency: 'NZD', alias: 'new zealand' },
  { code: 'FJ', name: 'フィジー', currency: 'FJD', alias: 'fiji' },
];

export const POPULAR = ['KR', 'TW', 'US', 'TH', 'FR', 'IT', 'GB', 'SG'];

export const CURRENCY_NAMES: Record<string, string> = {
  USD: '米ドル', EUR: 'ユーロ', KRW: '韓国ウォン', TWD: '台湾ドル', THB: 'タイバーツ', GBP: '英ポンド',
  SGD: 'シンガポールドル', HKD: '香港ドル', VND: 'ベトナムドン', AUD: '豪ドル', CHF: 'スイスフラン',
  CNY: '中国人民元', CAD: 'カナダドル', NZD: 'NZドル', JPY: '日本円',
};

export const currencyLabel = (c: string) => CURRENCY_NAMES[c] ?? c;
export const countryByCode = (code: string) => COUNTRIES.find(c => c.code === code);
export const allCurrencies = () => [...new Set(COUNTRIES.map(c => c.currency))].sort();

export function flag(code: string) {
  return [...code.toUpperCase()].map(ch => String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65)).join('');
}

export function searchCountries(q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return COUNTRIES;
  return COUNTRIES.filter(c => `${c.name} ${c.alias ?? ''} ${c.currency} ${c.code}`.toLowerCase().includes(s));
}
