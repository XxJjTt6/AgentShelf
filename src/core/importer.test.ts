import { describe, expect, it } from "vitest";
import { importCatalogCsv } from "./importer";

const header =
  "sku,title,price,currency,stock,category,material,water_resistant,shipping_country,shipping_fee,delivery_days,returns_days,claims";

describe("catalog CSV importer", () => {
  it("groups destination rows into one product passport", () => {
    const csv = [
      header,
      "CUBE-01,Carry Cube,29,USD,12,Travel Packing Organizers,Ripstop nylon,true,DE,4,3,30,Water-resistant|Three sizes",
      "CUBE-01,Carry Cube,29,USD,12,Travel Packing Organizers,Ripstop nylon,true,US,0,2,30,Water-resistant|Three sizes",
    ].join("\n");

    const result = importCatalogCsv(csv);

    expect(result.catalog).toHaveLength(1);
    expect(result.catalog[0].shipping).toHaveLength(2);
    expect(result.catalog[0].waterResistant).toBe(true);
    expect(result.catalog[0].claims).toHaveLength(2);
    expect(result.rowsAccepted).toBe(2);
    expect(result.issues).toHaveLength(0);
  });

  it("rejects unsupported currencies and keeps valid rows", () => {
    const csv = [
      header,
      "EUR-01,Euro Cube,20,EUR,4,Travel Packing Organizers,Nylon,true,DE,3,2,14,Compact",
      "USD-01,US Cube,22,USD,5,Travel Packing Organizers,Nylon,false,DE,5,4,30,Lightweight",
    ].join("\n");

    const result = importCatalogCsv(csv);

    expect(result.catalog).toHaveLength(1);
    expect(result.catalog[0].sku).toBe("USD-01");
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "currency", severity: "error" }),
      ]),
    );
  });

  it("reports malformed required fields without constructing a product", () => {
    const csv = [
      header,
      "BROKEN-01,,not-a-price,USD,-1,Travel Packing Organizers,,true,GERMANY,free,0,30,Claim",
    ].join("\n");

    const result = importCatalogCsv(csv);

    expect(result.catalog).toHaveLength(0);
    expect(result.issues.length).toBeGreaterThanOrEqual(1);
    expect(result.rowsAccepted).toBe(0);
  });
});
