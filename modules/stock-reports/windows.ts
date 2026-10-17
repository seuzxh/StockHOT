import { readFileSync } from "node:fs";
import { beijingAt } from "@aihot/contracts/time";

export type SessionKind = "premarket" | "postmarket";

interface TradingCalendar {
  version: string;
  source: string;
  timezone: "Asia/Shanghai";
  tradingDays: string[];
}

const CALENDAR = JSON.parse(readFileSync(new URL("./trading-calendar-2026.json", import.meta.url), "utf8")) as TradingCalendar;
const TRADING_DAYS = new Set(CALENDAR.tradingDays);

export interface SessionWindow {
  kind: SessionKind;
  tradingDate: string;
  start: Date;
  end: Date;
  calendarVersion: string;
}

export function isTradingDay(date: string): boolean {
  return TRADING_DAYS.has(date);
}

export function sessionWindow(kind: SessionKind, tradingDate: string): SessionWindow | null {
  const index = CALENDAR.tradingDays.indexOf(tradingDate);
  if (index < 0) return null;
  if (kind === "postmarket") {
    return { kind, tradingDate, start: beijingAt(tradingDate, "08:00"), end: beijingAt(tradingDate, "18:00"), calendarVersion: CALENDAR.version };
  }
  const previous = CALENDAR.tradingDays[index - 1];
  if (!previous) return null;
  return { kind, tradingDate, start: beijingAt(previous, "08:00"), end: beijingAt(tradingDate, "08:00"), calendarVersion: CALENDAR.version };
}

export function classifyArrival(
  publishedAt: Date | null,
  discoveredAt: Date,
  window: SessionWindow,
): "late" | "on_time" | "outside" {
  if (discoveredAt < window.start || discoveredAt >= window.end) return "outside";
  return publishedAt && publishedAt < window.start ? "late" : "on_time";
}
