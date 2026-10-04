export interface Language {
  code: string
  name: string
  english: string
  font?: string
  rtl?: boolean
  draft?: boolean
}

export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', english: 'English' },
  { code: 'hi', name: 'हिन्दी', english: 'Hindi', font: 'Noto Sans Devanagari' },
  { code: 'bn', name: 'বাংলা', english: 'Bengali', font: 'Noto Sans Bengali' },
  { code: 'te', name: 'తెలుగు', english: 'Telugu', font: 'Noto Sans Telugu' },
  { code: 'mr', name: 'मराठी', english: 'Marathi', font: 'Noto Sans Devanagari' },
  { code: 'ta', name: 'தமிழ்', english: 'Tamil', font: 'Noto Sans Tamil' },
  { code: 'ur', name: 'اردو', english: 'Urdu', font: 'Noto Nastaliq Urdu', rtl: true },
  { code: 'gu', name: 'ગુજરાતી', english: 'Gujarati', font: 'Noto Sans Gujarati' },
  { code: 'kn', name: 'ಕನ್ನಡ', english: 'Kannada', font: 'Noto Sans Kannada' },
  { code: 'or', name: 'ଓଡ଼ିଆ', english: 'Odia', font: 'Noto Sans Oriya' },
  { code: 'ml', name: 'മലയാളം', english: 'Malayalam', font: 'Noto Sans Malayalam' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', english: 'Punjabi', font: 'Noto Sans Gurmukhi' },
  { code: 'as', name: 'অসমীয়া', english: 'Assamese', font: 'Noto Sans Bengali' },
  { code: 'mai', name: 'मैथिली', english: 'Maithili', font: 'Noto Sans Devanagari' },
  { code: 'sat', name: 'ᱥᱟᱱᱛᱟᱲᱤ', english: 'Santali', font: 'Noto Sans Ol Chiki', draft: true },
  { code: 'ks', name: 'کٲشُر', english: 'Kashmiri', font: 'Noto Naskh Arabic', rtl: true, draft: true },
  { code: 'ne', name: 'नेपाली', english: 'Nepali', font: 'Noto Sans Devanagari' },
  { code: 'sd', name: 'سنڌي', english: 'Sindhi', font: 'Noto Naskh Arabic', rtl: true },
  { code: 'doi', name: 'डोगरी', english: 'Dogri', font: 'Noto Sans Devanagari' },
  { code: 'gom', name: 'कोंकणी', english: 'Konkani', font: 'Noto Sans Devanagari' },
  { code: 'mni', name: 'ꯃꯩꯇꯩꯂꯣꯟ', english: 'Manipuri', font: 'Noto Sans Meetei Mayek', draft: true },
  { code: 'brx', name: 'बड़ो', english: 'Bodo', font: 'Noto Sans Devanagari', draft: true },
  { code: 'sa', name: 'संस्कृतम्', english: 'Sanskrit', font: 'Noto Sans Devanagari' },
  { code: 'bho', name: 'भोजपुरी', english: 'Bhojpuri', font: 'Noto Sans Devanagari' },
  { code: 'hne', name: 'छत्तीसगढ़ी', english: 'Chhattisgarhi', font: 'Noto Sans Devanagari' },
  { code: 'tcy', name: 'ತುಳು', english: 'Tulu', font: 'Noto Sans Kannada', draft: true },
]
