/**
 * Canonical nationalities for the mom-intake form.
 *
 * `canonical` is the **feminine Arabic nisba** (records are mothers) — this is
 * what we store and display, and it stays consistent with the existing Saudi
 * label (سعودية). `aliases` are every other spelling that should resolve to it:
 * masculine nisba, country name (with/without "ال"), English demonym/country,
 * and common misspellings. Matching folds via `foldArabic` (tashkeel, ة/ه, أإآ/ا,
 * ى/ي, case, spacing), plus a leading-"ال" strip — so aliases only need to list
 * distinct WORD-forms, not every spelling of each.
 *
 * Plain data (no JSX / model imports) so it's importable from server routes and
 * client components alike. Extend freely; runtime admin additions live in the
 * NationalityAddition model.
 */

export interface NationalityEntry {
  /** Feminine Arabic nisba — stored & displayed. */
  canonical: string;
  /** Other spellings that map to `canonical` (folded before comparison). */
  aliases: string[];
}

export const NATIONALITIES: NationalityEntry[] = [
  // ── GCC ──
  { canonical: "سعودية", aliases: ["سعودي", "السعودية", "المملكة العربية السعودية", "سعودية الجنسية", "ksa", "saudi", "saudi arabia", "saudia", "سعودبه", "سعرديه"] },
  { canonical: "إماراتية", aliases: ["اماراتي", "الامارات", "الإمارات العربية المتحدة", "uae", "emirati", "united arab emirates"] },
  { canonical: "كويتية", aliases: ["كويتي", "الكويت", "kuwaiti", "kuwait"] },
  { canonical: "قطرية", aliases: ["قطري", "قطر", "qatari", "qatar"] },
  { canonical: "بحرينية", aliases: ["بحريني", "البحرين", "bahraini", "bahrain"] },
  { canonical: "عمانية", aliases: ["عماني", "عمان", "سلطنة عمان", "omani", "oman"] },

  // ── Levant / Iraq ──
  { canonical: "سورية", aliases: ["سوري", "سوريا", "سورية الجنسية", "syrian", "syria"] },
  { canonical: "لبنانية", aliases: ["لبناني", "لبنان", "lebanese", "lebanon", "lebnon"] },
  { canonical: "أردنية", aliases: ["اردني", "الاردن", "jordanian", "jordan"] },
  { canonical: "فلسطينية", aliases: ["فلسطيني", "فلسطين", "palestinian", "palestine"] },
  { canonical: "عراقية", aliases: ["عراقي", "العراق", "iraqi", "iraq"] },

  // ── Egypt / North & Horn Africa / other Arab ──
  { canonical: "مصرية", aliases: ["مصري", "مصر", "egyptian", "egypt"] },
  { canonical: "سودانية", aliases: ["سوداني", "السودان", "سودان", "سوادنية", "sudanese", "sudan"] },
  { canonical: "جنوب سودانية", aliases: ["جنوب سوداني", "جنوب السودان", "south sudanese", "south sudan"] },
  { canonical: "ليبية", aliases: ["ليبي", "ليبيا", "libyan", "libya"] },
  { canonical: "تونسية", aliases: ["تونسي", "تونس", "tunisian", "tunisia"] },
  { canonical: "جزائرية", aliases: ["جزائري", "الجزائر", "algerian", "algeria"] },
  { canonical: "مغربية", aliases: ["مغربي", "المغرب", "moroccan", "morocco"] },
  { canonical: "موريتانية", aliases: ["موريتاني", "موريتانيا", "mauritanian", "mauritania"] },
  { canonical: "يمنية", aliases: ["يمني", "اليمن", "يمن", "يمينه", "yemeni", "yemen"] },
  { canonical: "صومالية", aliases: ["صومالي", "الصومال", "صومال", "somali", "somalia"] },
  { canonical: "جيبوتية", aliases: ["جيبوتي", "djiboutian", "djibouti"] },
  { canonical: "قمرية", aliases: ["جزر القمر", "comorian", "comoros"] },

  // ── South & Southeast Asia (major labour-sending) ──
  { canonical: "باكستانية", aliases: ["باكستاني", "باكستان", "pakistani", "pakistan", "bakistan"] },
  { canonical: "هندية", aliases: ["هندي", "الهند", "هند", "indian", "india"] },
  { canonical: "بنغلاديشية", aliases: ["بنغلاديشي", "بنغلاديش", "بنجلاديش", "بنغلادش", "بنغالي", "بنغاليه", "bangladeshi", "bangladesh", "bengali"] },
  { canonical: "فلبينية", aliases: ["فلبيني", "الفلبين", "فلبين", "الفليبين", "فليبين", "فيليبيني", "filipino", "philippine", "philippines"] },
  { canonical: "إندونيسية", aliases: ["اندونيسي", "اندونيسيا", "indonesian", "indonesia"] },
  { canonical: "سريلانكية", aliases: ["سريلانكي", "سريلانكا", "sri lankan", "srilankan", "sri lanka"] },
  { canonical: "نيبالية", aliases: ["نيبالي", "نيبال", "nepali", "nepalese", "nepal"] },
  { canonical: "أفغانية", aliases: ["افغاني", "افغانستان", "افغانيستان", "afghan", "afghanistan"] },
  { canonical: "ماليزية", aliases: ["ماليزي", "ماليزيا", "malaysian", "malaysia"] },
  { canonical: "تايلاندية", aliases: ["تايلاندي", "تايلاند", "thai", "thailand"] },
  { canonical: "فيتنامية", aliases: ["فيتنامي", "فيتنام", "vietnamese", "vietnam"] },
  { canonical: "بورمية", aliases: ["بورمي", "بورما", "ميانمار", "burmese", "myanmar", "burma"] },

  // ── Wider Asia ──
  { canonical: "إيرانية", aliases: ["ايراني", "ايران", "iranian", "iran"] },
  { canonical: "تركية", aliases: ["تركي", "تركيا", "turkish", "turkey", "turkiye"] },
  { canonical: "صينية", aliases: ["صيني", "الصين", "chinese", "china"] },
  { canonical: "يابانية", aliases: ["ياباني", "اليابان", "japanese", "japan"] },
  { canonical: "كورية", aliases: ["كوري", "كوريا", "كوريا الجنوبية", "korean", "korea", "south korea"] },

  // ── Sub-Saharan Africa ──
  { canonical: "إثيوبية", aliases: ["اثيوبي", "اثيوبيا", "ethiopian", "ethiopia"] },
  { canonical: "إريترية", aliases: ["اريتري", "اريتريا", "eritrean", "eritrea"] },
  { canonical: "نيجيرية", aliases: ["نيجيري", "نيجيريا", "nigerian", "nigeria"] },
  { canonical: "نيجرية", aliases: ["النيجر", "nigerien", "niger"] },
  { canonical: "تشادية", aliases: ["تشادي", "تشاد", "chadian", "chad"] },
  { canonical: "مالية", aliases: ["مالي", "malian", "mali"] },
  { canonical: "سنغالية", aliases: ["سنغالي", "السنغال", "senegalese", "senegal"] },
  { canonical: "غانية", aliases: ["غانا", "ghanaian", "ghana"] },
  { canonical: "غينية", aliases: ["غينيا", "guinean", "guinea"] },
  { canonical: "كينية", aliases: ["كيني", "كينيا", "kenyan", "kenya"] },
  { canonical: "أوغندية", aliases: ["اوغندي", "اوغندا", "يوغاندا", "يوغندا", "ugandan", "uganda"] },
  { canonical: "تنزانية", aliases: ["تنزاني", "تنزانيا", "tanzanian", "tanzania"] },
  { canonical: "كاميرونية", aliases: ["كاميروني", "الكاميرون", "cameroonian", "cameroon"] },

  // ── Europe / Americas / Oceania (majors) ──
  { canonical: "أمريكية", aliases: ["امريكي", "امريكا", "الولايات المتحدة", "الولايات المتحدة الامريكية", "usa", "us", "american", "united states"] },
  { canonical: "بريطانية", aliases: ["بريطاني", "بريطانيا", "انجليزي", "انجلترا", "uk", "british", "britain", "england", "english"] },
  { canonical: "كندية", aliases: ["كندي", "كندا", "canadian", "canada"] },
  { canonical: "فرنسية", aliases: ["فرنسي", "فرنسا", "french", "france"] },
  { canonical: "ألمانية", aliases: ["الماني", "المانيا", "german", "germany"] },
  { canonical: "إيطالية", aliases: ["ايطالي", "ايطاليا", "italian", "italy"] },
  { canonical: "إسبانية", aliases: ["اسباني", "اسبانيا", "spanish", "spain"] },
  { canonical: "هولندية", aliases: ["هولندي", "هولندا", "dutch", "netherlands", "holland"] },
  { canonical: "يونانية", aliases: ["يوناني", "اليونان", "greek", "greece"] },
  { canonical: "رومانية", aliases: ["روماني", "رومانيا", "romanian", "romania"] },
  { canonical: "روسية", aliases: ["روسي", "روسيا", "russian", "russia"] },
  { canonical: "أوكرانية", aliases: ["اوكراني", "اوكرانيا", "ukrainian", "ukraine"] },
  { canonical: "برازيلية", aliases: ["برازيلي", "البرازيل", "brazilian", "brazil"] },
  { canonical: "أسترالية", aliases: ["استرالي", "استراليا", "australian", "australia"] },
  { canonical: "جنوب أفريقية", aliases: ["جنوب افريقي", "جنوب افريقيا", "south african", "south africa"] },
];
