import { calendarDay, calendarTime } from "./calendar";
export function bangkokDateTime(day: string, time: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    throw new Error("Choose a valid date and time.");
  const value = new Date(`${day}T${time}:00+07:00`);
  if (
    !Number.isFinite(value.getTime()) ||
    calendarDay(value) !== day ||
    calendarTime(value) !== time
  )
    throw new Error("Choose a valid date and time.");
  return value;
}

export function moveToBangkokDay(value: string, day: string) {
  const original = new Date(value);
  const moved = bangkokDateTime(day, calendarTime(original));
  moved.setUTCSeconds(original.getUTCSeconds(), original.getUTCMilliseconds());
  return moved;
}
