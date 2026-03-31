function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: weekdayMap[map.weekday] ?? 0,
  };
}

function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
) {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const actual = getDatePartsInTimeZone(utcGuess, timeZone);
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const actualAsUtc = Date.UTC(
    actual.year,
    actual.month - 1,
    actual.day,
    actual.hour,
    actual.minute,
    actual.second,
  );

  return new Date(utcGuess.getTime() - (actualAsUtc - desiredAsUtc));
}

export function calculateNextAutomationRun(options: {
  frequency: "manual" | "weekly";
  dayOfWeek: number | null;
  runTime: string | null;
  timezone: string | null;
  from?: Date;
}) {
  if (options.frequency !== "weekly" || options.dayOfWeek === null || !options.runTime) {
    return null;
  }

  const timeZone = options.timezone || "UTC";
  const from = options.from ?? new Date();
  const [hours, minutes] = options.runTime.split(":").map((value) => Number(value));

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  const localNow = getDatePartsInTimeZone(from, timeZone);

  for (let offset = 0; offset <= 7; offset += 1) {
    const base = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day + offset));
    const localCandidate = getDatePartsInTimeZone(base, timeZone);

    if (localCandidate.weekday !== options.dayOfWeek) {
      continue;
    }

    const candidate = zonedTimeToUtc(
      localCandidate.year,
      localCandidate.month,
      localCandidate.day,
      hours,
      minutes,
      timeZone,
    );

    if (candidate > from) {
      return candidate;
    }
  }

  const fallbackBase = new Date(
    Date.UTC(localNow.year, localNow.month - 1, localNow.day + 7),
  );
  const fallbackCandidate = getDatePartsInTimeZone(fallbackBase, timeZone);

  return zonedTimeToUtc(
    fallbackCandidate.year,
    fallbackCandidate.month,
    fallbackCandidate.day,
    hours,
    minutes,
    timeZone,
  );
}
