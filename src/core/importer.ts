import Papa from "papaparse";
import { z } from "zod";
import type { EvidenceRef, ProductClaim, ProductPassport, ShippingRule } from "./types";

const csvRowSchema = z.object({
  sku: z.string().trim().min(1),
  title: z.string().trim().min(1),
  price: z.coerce.number().nonnegative(),
  currency: z.string().trim().toUpperCase().default("USD"),
  stock: z.coerce.number().int().nonnegative(),
  category: z.string().trim().min(1),
  material: z.string().trim().default("Unknown"),
  water_resistant: z.string().trim().default("false"),
  shipping_country: z.string().trim().toUpperCase().length(2),
  shipping_fee: z.coerce.number().nonnegative(),
  delivery_days: z.coerce.number().int().positive(),
  returns_days: z.coerce.number().int().nonnegative(),
  claims: z.string().trim().default(""),
});

type CsvRow = z.infer<typeof csvRowSchema>;

export interface ImportIssue {
  row: number;
  field: string;
  severity: "error" | "warning";
  message: string;
}

export interface CatalogImportResult {
  catalog: ProductPassport[];
  issues: ImportIssue[];
  rowsRead: number;
  rowsAccepted: number;
}

function parseBoolean(value: string) {
  return ["true", "1", "yes", "y", "是"].includes(value.trim().toLowerCase());
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "product";
}

function claimsFromRow(row: CsvRow, skuSlug: string): ProductClaim[] {
  return row.claims
    .split("|")
    .map((claim) => claim.trim())
    .filter(Boolean)
    .map((claim, index) => ({
      id: `claim-${skuSlug}-${index + 1}`,
      text: claim,
      kind: "marketing" as const,
      evidenceIds: [`evidence-${skuSlug}-csv`],
      supported: true,
    }));
}

function evidenceFromRow(row: CsvRow, skuSlug: string, observedAt: string): EvidenceRef[] {
  return [
    {
      id: `evidence-${skuSlug}-csv`,
      label: `CSV 商品记录 ${row.sku}`,
      source: "merchant",
      trusted: true,
      observedAt,
    },
  ];
}

function issueFromZod(rowNumber: number, error: z.ZodError): ImportIssue[] {
  return error.issues.map((issue) => ({
    row: rowNumber,
    field: issue.path.join(".") || "row",
    severity: "error" as const,
    message: "字段缺失或格式不正确，请按 CSV 模板检查。",
  }));
}

export function importCatalogCsv(csv: string): CatalogImportResult {
  const parsed = Papa.parse<Record<string, unknown>>(csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim().toLowerCase(),
  });
  const issues: ImportIssue[] = parsed.errors.map((error) => ({
    row: (error.row ?? 0) + 2,
    field: "csv",
    severity: "error",
    message: "CSV 格式有误，请检查列数、引号和换行。",
  }));
  const accepted: Array<{ row: CsvRow; rowNumber: number }> = [];

  parsed.data.forEach((raw, index) => {
    const result = csvRowSchema.safeParse(raw);
    if (!result.success) {
      issues.push(...issueFromZod(index + 2, result.error));
      return;
    }
    if (result.data.currency !== "USD") {
      issues.push({
        row: index + 2,
        field: "currency",
        severity: "error",
        message: "当前版本仅支持 USD。其他币种需先按固定汇率换算。",
      });
      return;
    }
    accepted.push({ row: result.data, rowNumber: index + 2 });
  });

  const grouped = new Map<string, Array<{ row: CsvRow; rowNumber: number }>>();
  for (const item of accepted) {
    const existing = grouped.get(item.row.sku) ?? [];
    existing.push(item);
    grouped.set(item.row.sku, existing);
  }

  const observedAt = new Date().toISOString();
  const catalog: ProductPassport[] = [];

  for (const [sku, rows] of grouped) {
    const [first] = rows;
    const skuSlug = slug(sku);
    const shipping: ShippingRule[] = [];
    const seenCountries = new Set<string>();

    for (const { row, rowNumber } of rows) {
      if (seenCountries.has(row.shipping_country)) {
        issues.push({
          row: rowNumber,
          field: "shipping_country",
          severity: "warning",
          message: `SKU ${sku} 的 ${row.shipping_country} 配送规则重复，已保留第一条。`,
        });
        continue;
      }
      seenCountries.add(row.shipping_country);
      shipping.push({
        country: row.shipping_country,
        fee: row.shipping_fee,
        currency: "USD",
        deliveryDays: row.delivery_days,
        returnsDays: row.returns_days,
      });
    }

    catalog.push({
      id: `imported-${skuSlug}`,
      sku,
      title: first.row.title,
      subtitle: `已整理 ${shipping.length} 个目标国配送规则`,
      color: "gray",
      price: first.row.price,
      checkoutPrice: first.row.price,
      currency: "USD",
      stock: first.row.stock,
      category: first.row.category,
      material: first.row.material,
      waterResistant: parseBoolean(first.row.water_resistant),
      shipping,
      claims: claimsFromRow(first.row, skuSlug),
      reviews: [],
      evidence: evidenceFromRow(first.row, skuSlug, observedAt),
      version: 1,
    });
  }

  return {
    catalog,
    issues,
    rowsRead: parsed.data.length,
    rowsAccepted: accepted.length,
  };
}
