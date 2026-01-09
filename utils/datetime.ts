// Utilities xử lý datetime - Timezone: Asia/Ho_Chi_Minh (GMT+7)

export const TIMEZONE = "Asia/Ho_Chi_Minh";
export const DATETIME_FORMAT = "yyyy-MM-dd'T'HH:mm:ss"; // Format API
export const DATE_FORMAT = "yyyy-MM-dd"; // Format date only

// Parse datetime string từ API (hỗ trợ nhiều format)
export function parseDateTime(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;

  try {
    // Nếu chỉ có date, thêm time 00:00:00
    if (!dateStr.includes("T")) {
      dateStr = `${dateStr}T00:00:00`;
    }

    // Kiểm tra có timezone suffix không
    const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(dateStr);

    if (!hasTimezone) {
      // Backend trả về LocalDateTime (không có timezone)
      const date = new Date(dateStr);
      if (Number.isNaN(date.getTime())) {
        console.error(`[datetime] Invalid date string: ${dateStr}`);
        return null;
      }
      return date;
    }

    // Có timezone suffix - parse bình thường
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      console.error(`[datetime] Invalid date string: ${dateStr}`);
      return null;
    }
    return date;
  } catch (e) {
    console.error(`[datetime] Failed to parse date: ${dateStr}`, e);
    return null;
  }
}

// Lấy date key (YYYY-MM-DD) từ datetime string - dùng cho filter/group
export function toDateKey(dateStr: string | null | undefined): string {
  if (!dateStr) return "";

  try {
    // Date only - return trực tiếp
    if (!dateStr.includes("T")) {
      return dateStr.replaceAll("/", "-").substring(0, 10);
    }

    // Lấy date part từ ISO string
    const datePartMatch = /^(\d{4}-\d{2}-\d{2})/.exec(dateStr);
    if (datePartMatch) {
      // Nếu không có timezone indicator, treat as local server time và lấy date part trực tiếp
      const hasTimezone = /(Z|[+-]\d{2}:\d{2})$/.test(dateStr);
      if (!hasTimezone) {
        return datePartMatch[1];
      }
    }

    // Có timezone - convert sang Asia/Ho_Chi_Minh timezone rồi lấy date part
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      console.error(`[datetime] Invalid date for toDateKey: ${dateStr}`);
      return "";
    }

    const year = date.toLocaleString("en-US", { year: "numeric", timeZone: TIMEZONE });
    const month = date.toLocaleString("en-US", { month: "2-digit", timeZone: TIMEZONE });
    const day = date.toLocaleString("en-US", { day: "2-digit", timeZone: TIMEZONE });
    return `${year}-${month}-${day}`;
  } catch (e) {
    console.error(`[datetime] Failed to get date key: ${dateStr}`, e);
    return "";
  }
}

// Lấy ngày hôm nay (YYYY-MM-DD) theo timezone VN
export function getTodayDateKey(): string {
  const now = new Date();
  const year = now.toLocaleString("en-US", { year: "numeric", timeZone: TIMEZONE });
  const month = now.toLocaleString("en-US", { month: "2-digit", timeZone: TIMEZONE });
  const day = now.toLocaleString("en-US", { day: "2-digit", timeZone: TIMEZONE });
  return `${year}-${month}-${day}`;
}

// Options mặc định cho format datetime
const DEFAULT_DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: TIMEZONE,
};

// Format datetime cho hiển thị
export function formatDateTime(
  dateStr: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return "-";

  const date = parseDateTime(dateStr);
  if (!date) return "-";

  try {
    return date.toLocaleString("ja-JP", options ?? DEFAULT_DATETIME_OPTIONS);
  } catch (e) {
    console.error(`[datetime] Failed to format date: ${dateStr}`, e);
    return "-";
  }
}

// Format time (HH:mm)
export function formatTime(dateStr: string | null | undefined): string {
  return formatDateTime(dateStr, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  });
}

// Format time với giây (HH:mm:ss)
export function formatTimeWithSeconds(dateStr: string | null | undefined): string {
  return formatDateTime(dateStr, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: TIMEZONE,
  });
}

// Format date (YYYY/MM/DD)
export function formatDate(dateStr: string | null | undefined, locale: string = "ja-JP"): string {
  return formatDateTime(dateStr, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TIMEZONE,
  });
}

// Format ngắn gọn (MM/DD HH:mm)
export function formatDateTimeShort(dateStr: string | null | undefined): string {
  return formatDateTime(dateStr, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  });
}

// Chuyển datetime-local input → format API (thêm :00)
export function datetimeLocalToApiFormat(datetimeLocal: string): string {
  if (!datetimeLocal) return "";

  // datetime-local format: "yyyy-MM-ddTHH:mm"
  // API format: "yyyy-MM-ddTHH:mm:ss"
  if (datetimeLocal.split(":").length === 2) {
    return `${datetimeLocal}:00`;
  }
  return datetimeLocal;
}

// Chuyển API datetime → datetime-local input (bỏ :ss)
export function apiFormatToDatetimeLocal(apiDatetime: string): string {
  if (!apiDatetime) return "";

  // API format: "yyyy-MM-ddTHH:mm:ss" hoặc "yyyy-MM-ddTHH:mm:ss.SSS"
  // datetime-local format: "yyyy-MM-ddTHH:mm"
  return apiDatetime.substring(0, 16);
}

// Date object → API format (yyyy-MM-ddTHH:mm:ss)
export function toApiDateTimeFormat(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

// Date object → API date format (yyyy-MM-dd)
export function toApiDateFormat(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Cộng thêm phút
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

// Cộng thêm giờ
export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

// Cộng thêm ngày
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// Kiểm tra có phải hôm nay không (theo timezone VN)
export function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return toDateKey(dateStr) === getTodayDateKey();
}

// So sánh 2 datetime (-1: a < b, 0: bằng, 1: a > b)
export function compareDateTimes(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const dateA = parseDateTime(a);
  const dateB = parseDateTime(b);

  if (!dateA && !dateB) return 0;
  if (!dateA) return -1;
  if (!dateB) return 1;

  return dateA.getTime() - dateB.getTime();
}
