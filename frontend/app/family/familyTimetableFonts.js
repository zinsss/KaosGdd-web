export const FAMILY_TIMETABLE_DEFAULT_FONT = "system";

export const FAMILY_TIMETABLE_FONT_PRESETS = [
  { value: "system", label: "기본", fontFamily: "" },
  { value: "SeoulNamsanCondensed", label: "서울남산", fontFamily: "Seoul Namsan Condensed" },
  { value: "LeeSunSinDotum", label: "이순신돋움", fontFamily: "LeeSunSinDotum" },
  { value: "Kita", label: "KITA", fontFamily: "Kita" },
  { value: "NanumBarunPen", label: "나눔바른펜", fontFamily: "NanumBarunPen" },
  { value: "KyoboHandwriting2024SeoWooPark", label: "교보손글씨", fontFamily: "KyoboHandwriting2024SeoWooPark" },
  { value: "HancomMalrangmalrang", label: "말랑말랑", fontFamily: "HancomMalrangmalrang" },
  { value: "BinggraeSsamanco", label: "싸만코", fontFamily: "BinggraeSsamanco" },
  { value: "BandalNationalPark", label: "반달", fontFamily: "BandalNationalPark" },
  { value: "SchoolSafetyChalkboardEraser", label: "칠판지우개", fontFamily: "SchoolSafetyChalkboardEraser" },
  { value: "SchoolSafetyMilkyWay", label: "은하수", fontFamily: "SchoolSafetyMilkyWay" },
  { value: "SchoolSafeBoardMarker", label: "보드마커", fontFamily: "SchoolSafeBoardMarker" },
  { value: "Watermelon", label: "수박", fontFamily: "Watermelon" },
];

export function normalizeFamilyTimetableFont(value) {
  return FAMILY_TIMETABLE_FONT_PRESETS.some((preset) => preset.value === value)
    ? value
    : FAMILY_TIMETABLE_DEFAULT_FONT;
}

export function getFamilyTimetableFontFamily(value) {
  const normalized = normalizeFamilyTimetableFont(value);
  const preset = FAMILY_TIMETABLE_FONT_PRESETS.find((candidate) => candidate.value === normalized);
  return preset?.fontFamily || "";
}
