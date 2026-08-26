import * as XLSX from "xlsx";

export interface ParsedPosition {
  symbol: string; // underlying ticker
  description?: string;
  assetType: "stock" | "option" | "etf" | "other";
  quantity: number;
  costBasis?: number; // per unit
  price?: number;
  currency?: string;
  optionType?: "call" | "put";
  strike?: number;
  expiry?: string; // YYYY-MM-DD
  rawSymbol?: string;
}

export interface ParseResult {
  format: "ibkr" | "generic";
  positions: ParsedPosition[];
  skipped: number;
  warnings: string[];
}

/** Parse an OCC-style option symbol like "NFLX 261016C00095000". */
function parseOccSymbol(raw: string):
  | { underlying: string; expiry: string; optionType: "call" | "put"; strike: number }
  | null {
  const m = raw.trim().match(/^([A-Za-z.]{1,7})\s*(\d{6})([CPcp])(\d{8})$/);
  if (!m) return null;
  const [, underlying, ymd, cp, strikeRaw] = m;
  const expiry = `20${ymd.slice(0, 2)}-${ymd.slice(2, 4)}-${ymd.slice(4, 6)}`;
  return {
    underlying: underlying.toUpperCase(),
    expiry,
    optionType: cp.toUpperCase() === "C" ? "call" : "put",
    strike: parseInt(strikeRaw, 10) / 1000,
  };
}

function toNumber(v: unknown): number | undefined {
  if (v == null || v === "" || v === "--") return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const cleaned = String(v).replace(/[,$\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function normHeader(h: unknown): string {
  return String(h ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * IBKR Activity / Default statement CSV: rows are
 *   <Section>,Header,<columns...>
 *   <Section>,Data,<values...>
 * We read the "Open Positions" (or "Positions") section.
 */
function parseIbkr(rows: unknown[][]): ParseResult | null {
  let header: string[] | null = null;
  const positions: ParsedPosition[] = [];
  let skipped = 0;
  const warnings: string[] = [];
  let sawSection = false;

  for (const row of rows) {
    const section = String(row[0] ?? "").trim();
    const kind = String(row[1] ?? "").trim().toLowerCase();
    if (section !== "Open Positions" && section !== "Positions") continue;
    sawSection = true;

    if (kind === "header") {
      header = row.slice(2).map((h) => normHeader(h));
      continue;
    }
    if (kind !== "data" || !header) continue;

    const hdr: string[] = header;
    const rec: Record<string, unknown> = {};
    row.slice(2).forEach((v, i) => {
      if (hdr[i]) rec[hdr[i]] = v;
    });

    const assetCategory = String(rec["assetcategory"] ?? "").toLowerCase();
    const rawSymbol = String(rec["symbol"] ?? "").trim();
    if (!rawSymbol) {
      skipped++;
      continue;
    }

    const quantity = toNumber(rec["quantity"]);
    if (quantity == null || quantity === 0) {
      skipped++;
      continue;
    }

    const costPrice =
      toNumber(rec["costprice"]) ??
      toNumber(rec["averageprice"]) ??
      toNumber(rec["avgprice"]);
    const markPrice = toNumber(rec["markprice"]) ?? toNumber(rec["closeprice"]);
    const description = String(rec["description"] ?? "").trim() || undefined;
    const currency = String(rec["currency"] ?? "USD").trim() || "USD";

    const isOption =
      assetCategory.includes("option") || parseOccSymbol(rawSymbol) != null;

    if (isOption) {
      const occ = parseOccSymbol(rawSymbol);
      if (!occ) {
        warnings.push(`Could not parse option symbol "${rawSymbol}" — skipped`);
        skipped++;
        continue;
      }
      positions.push({
        symbol: occ.underlying,
        description,
        assetType: "option",
        quantity,
        costBasis: costPrice,
        price: markPrice,
        currency,
        optionType: occ.optionType,
        strike: occ.strike,
        expiry: occ.expiry,
        rawSymbol,
      });
    } else {
      positions.push({
        symbol: rawSymbol.toUpperCase(),
        description,
        assetType: assetCategory.includes("etf") ? "etf" : "stock",
        quantity,
        costBasis: costPrice,
        price: markPrice,
        currency,
      });
    }
  }

  if (!sawSection) return null;
  return { format: "ibkr", positions, skipped, warnings };
}

/** Generic sheet: a header row with Symbol/Ticker, Quantity, Cost columns. */
function parseGeneric(rows: unknown[][]): ParseResult {
  const warnings: string[] = [];
  let headerRowIdx = -1;
  let header: string[] = [];

  const findCol = (...names: string[]) =>
    names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;

  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const h = (rows[i] ?? []).map(normHeader);
    const hasSymbol = h.some((c) => ["symbol", "ticker", "instrument"].includes(c));
    const hasQty = h.some((c) => ["quantity", "qty", "shares", "position", "units"].includes(c));
    if (hasSymbol && hasQty) {
      headerRowIdx = i;
      header = h;
      break;
    }
  }

  if (headerRowIdx < 0) {
    return {
      format: "generic",
      positions: [],
      skipped: 0,
      warnings: [
        "No header row found. Expected columns like Symbol, Quantity, Cost Basis (or an IBKR Open Positions export).",
      ],
    };
  }

  const cSymbol = findCol("symbol", "ticker", "instrument");
  const cQty = findCol("quantity", "qty", "shares", "position", "units");
  const cCost = findCol("costbasis", "costprice", "averagecost", "avgcost", "avgprice", "averageprice", "basis");
  const cPrice = findCol("price", "lastprice", "markprice", "close", "closeprice", "currentprice");
  const cDesc = findCol("description", "name", "securityname");
  const cType = findCol("type", "assettype", "assetcategory", "assetclass");

  const positions: ParsedPosition[] = [];
  let skipped = 0;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rawSymbol = String(row[cSymbol] ?? "").trim();
    if (!rawSymbol) continue;

    const quantity = toNumber(row[cQty]);
    if (quantity == null || quantity === 0) {
      skipped++;
      continue;
    }

    const typeHint = String(row[cType] ?? "").toLowerCase();
    const occ = parseOccSymbol(rawSymbol);
    const isOption = typeHint.includes("option") || occ != null;

    if (isOption && occ) {
      positions.push({
        symbol: occ.underlying,
        description: cDesc >= 0 ? String(row[cDesc] ?? "").trim() || undefined : undefined,
        assetType: "option",
        quantity,
        costBasis: cCost >= 0 ? toNumber(row[cCost]) : undefined,
        price: cPrice >= 0 ? toNumber(row[cPrice]) : undefined,
        optionType: occ.optionType,
        strike: occ.strike,
        expiry: occ.expiry,
        rawSymbol,
      });
    } else {
      if (isOption && !occ) {
        warnings.push(`Row ${i + 1}: option "${rawSymbol}" not in OCC format — imported as stock`);
      }
      positions.push({
        symbol: rawSymbol.toUpperCase(),
        description: cDesc >= 0 ? String(row[cDesc] ?? "").trim() || undefined : undefined,
        assetType: typeHint.includes("etf") ? "etf" : "stock",
        quantity,
        costBasis: cCost >= 0 ? toNumber(row[cCost]) : undefined,
        price: cPrice >= 0 ? toNumber(row[cPrice]) : undefined,
      });
    }
  }

  return { format: "generic", positions, skipped, warnings };
}

/**
 * Parse an uploaded positions file (IBKR CSV export, or generic xlsx/csv with
 * Symbol / Quantity / Cost Basis columns).
 */
export function parsePositionsFile(buffer: Buffer, filename: string): ParseResult {
  const wb = XLSX.read(buffer, { type: "buffer", raw: true });

  // IBKR exports may place sections in the first sheet; scan all sheets.
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
      blankrows: false,
    });
    const ibkr = parseIbkr(rows);
    if (ibkr && ibkr.positions.length > 0) return ibkr;
  }

  // Fall back to generic parsing on the first sheet.
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
    defval: "",
    blankrows: false,
  });
  const generic = parseGeneric(rows);
  if (generic.positions.length === 0 && generic.warnings.length === 0) {
    generic.warnings.push(`File "${filename}" contained no recognizable positions.`);
  }
  return generic;
}
