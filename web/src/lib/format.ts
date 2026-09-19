/** Display formatting helpers — dates, sizes, shas. */

export function shortSha(sha?: string | null, len = 7): string {
  return sha ? sha.slice(0, len) : "—";
}

export function timeAgo(value?: number | string | null): string {
  if (value === undefined || value === null) return "";
  const date =
    typeof value === "number"
      ? new Date(value > 1e12 ? value : value * 1000)
      : new Date(value.includes("T") ? value : value + "Z");
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [31536000, "year"],
    [2592000, "month"],
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];
  const rtf = new Intl.RelativeTimeFormat(
    document.documentElement.lang === "en" ? "en" : "zh-CN",
    { numeric: "auto" },
  );
  for (const [unit, name] of steps) {
    if (seconds >= unit) return rtf.format(-Math.floor(seconds / unit), name);
  }
  return rtf.format(0, "minute");
}

export function fullDate(value?: number | string | null): string {
  if (value === undefined || value === null) return "";
  const date =
    typeof value === "number"
      ? new Date(value > 1e12 ? value : value * 1000)
      : new Date(value.includes("T") ? value : value + "Z");
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(document.documentElement.lang === "en" ? "en" : "zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function bytes(size?: number | null): string {
  if (size === undefined || size === null) return "";
  if (size < 1024) return `${size} B`;
  const units = ["KiB", "MiB", "GiB"];
  let v = size;
  let i = -1;
  do {
    v /= 1024;
    i++;
  } while (v >= 1024 && i < units.length - 1);
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

export function extOf(path: string): string {
  const name = path.split("/").pop() || "";
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}
