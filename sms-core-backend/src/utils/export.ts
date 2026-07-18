import { Response } from "express";

/**
 * Converts an array of flat-or-nested objects to a CSV string.
 * Nested objects are JSON.stringify'd. Handles commas, quotes, newlines.
 */
export function toCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";

  // Collect all keys in order of first appearance across all rows
  const keys: string[] = [];
  for (const row of data) {
    for (const key of Object.keys(row)) {
      if (!keys.includes(key)) keys.push(key);
    }
  }

  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    const str = typeof val === "object" ? JSON.stringify(val) : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = keys.map(escape).join(",");
  const rows = data.map((row) => keys.map((k) => escape(row[k])).join(","));
  return [header, ...rows].join("\n");
}

/**
 * Sends a CSV file download response.
 * Sets Content-Type and Content-Disposition headers automatically.
 */
export function respondCSV(res: Response, csv: string, filename: string): Response {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}.csv"`
  );
  return res.status(200).send("\uFEFF" + csv); // BOM for Excel UTF-8
}
