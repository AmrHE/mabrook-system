/**
 * Shared source of truth for the data-quality drill-down: maps each panel
 * counter to its slug, page title, table columns, and CSV filename. Plain data
 * (no JSX / model imports) so it is importable from server routes, server
 * pages, and client components alike.
 */
export interface DqColumn {
  key: string;
  header: string;
}

export interface DqCategory {
  slug: string;
  statKey:
    | "momsMissingPhone"
    | "momsMissingNationality"
    | "unsignedMoms"
    | "duplicatePhones"
    | "visitsWithZeroMoms"
    | "lowMomRateVisits"
    | "openShifts";
  label: string;
  titleAr: string;
  /** Shown under the drill-down heading, e.g. to explain count mismatches. */
  subtitleAr?: string;
  columns: DqColumn[];
  filename: string;
  /** false = the drill-down ignores from/to (matches the panel's global count). */
  rangeBound: boolean;
}

const MOM_COLUMNS: DqColumn[] = [
  { key: "name", header: "الاسم" },
  { key: "nationality", header: "الجنسية" },
  { key: "phoneNumber", header: "الهاتف" },
  { key: "hospital", header: "المستشفى" },
  { key: "city", header: "المدينة" },
  { key: "employee", header: "الموظف" },
  { key: "createdAt", header: "تاريخ التسجيل" },
];

const withoutColumn = (cols: DqColumn[], key: string) => cols.filter((c) => c.key !== key);

export const DQ_CATEGORIES: DqCategory[] = [
  {
    slug: "moms-missing-phone",
    statKey: "momsMissingPhone",
    label: "أمهات بدون رقم هاتف",
    titleAr: "أمهات بدون رقم هاتف",
    columns: withoutColumn(MOM_COLUMNS, "phoneNumber"),
    filename: "moms-missing-phone.csv",
    rangeBound: true,
  },
  {
    slug: "moms-missing-nationality",
    statKey: "momsMissingNationality",
    label: "أمهات بدون جنسية",
    titleAr: "أمهات بدون جنسية",
    columns: withoutColumn(MOM_COLUMNS, "nationality"),
    filename: "moms-missing-nationality.csv",
    rangeBound: true,
  },
  {
    slug: "unsigned-moms",
    statKey: "unsignedMoms",
    label: "أمهات بدون توقيع",
    titleAr: "أمهات بدون توقيع",
    columns: MOM_COLUMNS,
    filename: "unsigned-moms.csv",
    rangeBound: true,
  },
  {
    slug: "duplicate-phones",
    statKey: "duplicatePhones",
    label: "أرقام هواتف مكررة",
    titleAr: "أرقام هواتف مكررة",
    subtitleAr: "يعرض جميع السجلات المشتركة في رقم مكرر، لذا قد يزيد عدد الصفوف عن عدد الأرقام المكررة.",
    columns: [
      { key: "phoneNumber", header: "الهاتف المكرر" },
      { key: "dupCount", header: "عدد التكرارات" },
      { key: "name", header: "الاسم" },
      { key: "nationality", header: "الجنسية" },
      { key: "hospital", header: "المستشفى" },
      { key: "city", header: "المدينة" },
      { key: "employee", header: "الموظف" },
      { key: "createdAt", header: "تاريخ التسجيل" },
    ],
    filename: "duplicate-phones.csv",
    rangeBound: true,
  },
  {
    slug: "visits-without-moms",
    statKey: "visitsWithZeroMoms",
    label: "زيارات بدون أمهات",
    titleAr: "زيارات بدون أمهات",
    columns: [
      { key: "hospital", header: "المستشفى" },
      { key: "city", header: "المدينة" },
      { key: "employee", header: "الموظف" },
      { key: "status", header: "حالة الزيارة" },
      { key: "createdAt", header: "تاريخ الزيارة" },
    ],
    filename: "visits-without-moms.csv",
    rangeBound: true,
  },
  {
    slug: "low-mom-rate-visits",
    statKey: "lowMomRateVisits",
    label: "زيارات بإنتاجية منخفضة",
    titleAr: "زيارات بإنتاجية منخفضة",
    subtitleAr:
      "زيارات منتهية سجّلت أمهات بمعدل (أمهات/ساعة) أقل بكثير من متوسط الفريق. " +
      "لا تشمل الزيارات القصيرة ولا الزيارات بلا أمهات (لها تنبيه منفصل).",
    columns: [
      { key: "hospital", header: "المستشفى" },
      { key: "city", header: "المدينة" },
      { key: "employee", header: "الموظف" },
      { key: "momsCount", header: "عدد الأمهات" },
      { key: "durationHours", header: "المدة (ساعات)" },
      { key: "momsPerHour", header: "أمهات/ساعة" },
      { key: "createdAt", header: "تاريخ الزيارة" },
    ],
    filename: "low-mom-rate-visits.csv",
    rangeBound: true,
  },
  {
    slug: "open-shifts",
    statKey: "openShifts",
    // A shift now spans a whole day, so "open right now" mostly means "at work".
    // What is actually a defect is a day that was never closed.
    label: "أيام دوام متروكة مفتوحة",
    titleAr: "أيام دوام متروكة مفتوحة",
    subtitleAr: "أيام دوام من تواريخ سابقة لم يتم إنهاؤها، بغض النظر عن الفترة المحددة.",
    columns: [
      { key: "employee", header: "الموظف" },
      { key: "email", header: "البريد" },
      { key: "startTime", header: "أول دخول" },
      { key: "openSince", header: "بداية الجلسة المفتوحة" },
      { key: "sessionsCount", header: "الجلسات" },
      { key: "elapsedHours", header: "الساعات المنقضية" },
    ],
    filename: "open-shifts.csv",
    rangeBound: false,
  },
];

export const DQ_BY_SLUG: Record<string, DqCategory> = Object.fromEntries(
  DQ_CATEGORIES.map((c) => [c.slug, c]),
);
