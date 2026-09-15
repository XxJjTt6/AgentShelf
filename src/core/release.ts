import type { ListingDraft } from "./launch";
import { marketLabels, platformLabels } from "./launch";
import type { MissionRegressionReport } from "./regression";
import type { RunReport } from "./types";

export interface ReleaseArtifact {
  name: string;
  label: string;
  mimeType: string;
  body: string;
}

export interface ReleaseApproval {
  contentConfirmed: true;
  commerceStateConfirmed: true;
  confirmedAt: string;
}

function safeCsvCell(value: string | number | boolean) {
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(rows: Array<Array<string | number | boolean>>) {
  return rows.map((row) => row.map(safeCsvCell).join(",")).join("\n");
}

function baseArtifacts(report: RunReport): ReleaseArtifact[] {
  const productFeed = [
    ["id", "title", "description", "link", "image_link", "availability", "price", "brand"],
    ...report.catalog.map((product) => [
      product.sku,
      product.title,
      product.claims.map((claim) => claim.text).join("; "),
      `https://merchant.example/products/${encodeURIComponent(product.sku)}`,
      "https://merchant.example/assets/product.jpg",
      product.stock > 0 ? "in_stock" : "out_of_stock",
      `${product.price.toFixed(2)} ${product.currency}`,
      "AgentShelf Demo Merchant",
    ]),
  ];
  const schemaGraph = report.catalog.map((product) => ({
    "@type": "Product",
    sku: product.sku,
    name: product.title,
    description: product.claims.map((claim) => claim.text).join("；"),
    material: product.material,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: product.currency,
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  }));

  return [
    {
      name: "product-passport-v2.json",
      label: "商品档案",
      mimeType: "application/json",
      body: JSON.stringify(report.catalog, null, 2),
    },
    {
      name: "openai-product-feed.csv",
      label: "商品 商品数据文件",
      mimeType: "text/csv;charset=utf-8",
      body: csv(productFeed),
    },
    {
      name: "schema-org-product.jsonld",
      label: "Schema.org",
      mimeType: "application/ld+json",
      body: JSON.stringify({ "@context": "https://schema.org", "@graph": schemaGraph }, null, 2),
    },
    {
      name: "ucp-adapter-manifest.json",
      label: "UCP 适配器",
      mimeType: "application/json",
      body: JSON.stringify(
        {
          version: "0.1.0",
          capabilities: ["product.discovery", "availability", "shipping.quote", "cart", "checkout.mock"],
          confirmationRequired: report.mission.confirmationRequired,
          catalogVersion: report.catalog.map((product) => ({ sku: product.sku, version: product.version })),
        },
        null,
        2,
      ),
    },
    {
      name: "red-team-report.json",
      label: "测试证据",
      mimeType: "application/json",
      body: JSON.stringify(report, null, 2),
    },
  ];
}

function launchArtifacts(draft: ListingDraft): ReleaseArtifact[] {
  const prefix = `${draft.platform}-${draft.market.toLowerCase()}`;
  const listing = {
    id: draft.id,
    platform: platformLabels[draft.platform],
    market: marketLabels[draft.market],
    locale: draft.language,
    sourceVersion: draft.sourceVersion,
    outputVersion: draft.outputVersion,
    generation: draft.generation,
    title: draft.title,
    bullets: draft.bullets,
    description: draft.description,
    searchTerms: draft.searchTerms,
    attributes: draft.attributes,
  };

  return [
    {
      name: `${prefix}-listing.json`,
      label: "本地化商品文案",
      mimeType: "application/json",
      body: JSON.stringify(listing, null, 2),
    },
    {
      name: `${prefix}-listing.csv`,
      label: "平台导入表",
      mimeType: "text/csv;charset=utf-8",
      body: csv([
        ["listing_id", "platform", "market", "locale", "title", "bullets", "description", "search_terms", "source_version", "output_version"],
        [
          draft.id,
          draft.platform,
          draft.market,
          draft.language,
          draft.title,
          draft.bullets.join(" | "),
          draft.description,
          draft.searchTerms.join(" | "),
          draft.sourceVersion,
          draft.outputVersion,
        ],
      ]),
    },
    {
      name: `${prefix}-preflight-report.json`,
      label: "平台预检报告",
      mimeType: "application/json",
      body: JSON.stringify(
        {
          listingId: draft.id,
          generation: draft.generation,
          status: draft.status,
          score: draft.score,
          blockingFailures: draft.checks.filter((check) => !check.passed && check.severity === "blocking"),
          warnings: draft.checks.filter((check) => !check.passed && check.severity === "warning"),
          checks: draft.checks,
        },
        null,
        2,
      ),
    },
    {
      name: `${prefix}-claim-evidence.json`,
      label: "卖点来源记录",
      mimeType: "application/json",
      body: JSON.stringify(
        {
          listingId: draft.id,
          sourceVersion: draft.sourceVersion,
          claims: draft.claims,
        },
        null,
        2,
      ),
    },
  ];
}

export function buildReleaseArtifacts(
  report: RunReport,
  draft: ListingDraft | null = null,
  approval: ReleaseApproval | null = null,
  regression: MissionRegressionReport | null = null,
) {
  const approvalArtifacts: ReleaseArtifact[] = approval
    ? [{
        name: "release-approval.json",
        label: "人工确认记录",
        mimeType: "application/json",
        body: JSON.stringify(
          {
            runId: report.id,
            listingId: draft?.id ?? null,
            ...approval,
          },
          null,
          2,
        ),
      }]
    : [];
  const regressionArtifacts: ReleaseArtifact[] = regression
    ? [{
        name: "mission-regression-report.json",
        label: "30 项任务复测",
        mimeType: "application/json",
        body: JSON.stringify(regression, null, 2),
      }]
    : [];
  return [
    ...(draft ? launchArtifacts(draft) : []),
    ...approvalArtifacts,
    ...regressionArtifacts,
    ...baseArtifacts(report),
  ];
}
