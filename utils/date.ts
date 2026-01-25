import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import localizedFormat from "dayjs/plugin/localizedFormat";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(localizedFormat);

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as any).dayjs = dayjs;
}

const localeModules = import.meta.glob("../node_modules/dayjs/locale/*.js");

const getUserTimezone = (): string => {
  return dayjs.tz.guess();
};

const loadedLocales = new Set<string>();

export const initLocale = async (locale?: string): Promise<void> => {
  if (typeof window === "undefined") return;

  const userLocale = locale || Intl.DateTimeFormat().resolvedOptions().locale;
  const langCode = userLocale.split("-")[0].toLowerCase();

  const localeKey = Object.keys(localeModules).find((key) => key.includes(`/${langCode}.js`));

  if (localeKey && !loadedLocales.has(langCode)) {
    try {
      await localeModules[localeKey]();
      loadedLocales.add(langCode);
    } catch (error) {
      console.error(`Failed to load locale ${langCode}:`, error);
    }
  }

  dayjs.locale(langCode);
};

export const formatDateTime = (
  date: string | Date | number | dayjs.Dayjs | null | undefined,
  format: string = "YYYY/MM/DD HH:mm"
): string => {
  if (!date) return "--";
  return dayjs(date).tz(getUserTimezone()).format(format);
};

export const getLocalBusinessDate = (format: string = "YYYY-MM-DD"): string => {
  return dayjs().tz(getUserTimezone()).format(format);
};

export const dateHelper = dayjs;
export default dayjs;
