import type { ProductClaim, ProductPassport } from "./types";

export type LaunchPlatform = "amazon" | "shopify" | "tiktok-shop";
export type LaunchMarket = "DE" | "US";
export type ListingLanguage = "de-DE" | "en-US";

export interface LaunchBrief {
  productId: string;
  platform: LaunchPlatform;
  market: LaunchMarket;
  language: ListingLanguage;
  category: string;
}

export interface EvidenceBackedClaim {
  id: string;
  text: string;
  kind: ProductClaim["kind"];
  evidenceIds: string[];
  evidenceLabels: string[];
  verified: boolean;
}

export interface PlatformCheck {
  id: string;
  label: string;
  passed: boolean;
  severity: "blocking" | "warning";
  detail: string;
}

export interface ListingPlan {
  titleClaimId: string;
  claimOrder: string[];
  descriptionTone: "concise" | "detailed";
  searchTermOrder: number[];
}

export interface ListingDraft {
  id: string;
  productId: string;
  sourceVersion: number;
  outputVersion: number;
  platform: LaunchPlatform;
  market: LaunchMarket;
  language: ListingLanguage;
  title: string;
  bullets: string[];
  description: string;
  searchTerms: string[];
  attributes: Array<{ label: string; value: string; source: string }>;
  claims: EvidenceBackedClaim[];
  checks: PlatformCheck[];
  score: number;
  status: "ready" | "review" | "blocked";
  generation: {
    mode: "deterministic" | "qwen-assisted";
    model: string | null;
    plan: ListingPlan | null;
  };
}

export const platformLabels: Record<LaunchPlatform, string> = {
  amazon: "Amazon",
  shopify: "Shopify",
  "tiktok-shop": "TikTok Shop",
};

export const marketLabels: Record<LaunchMarket, string> = {
  DE: "德国",
  US: "美国",
};

const platformRules: Record<LaunchPlatform, { titleMax: number; bulletMin: number; bulletMax: number }> = {
  amazon: { titleMax: 200, bulletMin: 3, bulletMax: 5 },
  shopify: { titleMax: 255, bulletMin: 3, bulletMax: 6 },
  "tiktok-shop": { titleMax: 255, bulletMin: 3, bulletMax: 5 },
};

const unsafeClaimPattern = /\bipx\d\b|100%\s*waterproof|waterproof\s+certified|防水认证|完全防水/i;

function brandName(product: ProductPassport) {
  return product.title.trim().split(/\s+/)[0] || product.sku;
}

function localizedClaim(text: string, language: ListingLanguage) {
  const dictionary: Record<string, Record<ListingLanguage, string>> = {
    "DWR 防泼水表层": {
      "de-DE": "DWR-beschichtete, wasserabweisende Oberfläche",
      "en-US": "DWR-treated water-resistant finish",
    },
    "三种尺寸，可折叠收纳": {
      "de-DE": "Drei Größen, platzsparend faltbar",
      "en-US": "Three sizes with a fold-flat design",
    },
    "防泼水涂层": {
      "de-DE": "Wasserabweisende Beschichtung",
      "en-US": "Water-resistant coating",
    },
    "轻量透气网面": {
      "de-DE": "Leichtes, atmungsaktives Netzmaterial",
      "en-US": "Lightweight breathable mesh",
    },
    "双层分区": {
      "de-DE": "Zwei getrennte Fächer",
      "en-US": "Dual-compartment organization",
    },
    "可组合模块化结构": {
      "de-DE": "Modular kombinierbares Design",
      "en-US": "Modular mix-and-match design",
    },
    "防泼水内衬": {
      "de-DE": "Wasserabweisendes Innenfutter",
      "en-US": "Water-resistant lining",
    },
    "四件分区套装": {
      "de-DE": "Vierteiliges Organisationsset",
      "en-US": "Four-piece organization set",
    },
    "全网面透气结构": {
      "de-DE": "Vollflächiges, atmungsaktives Netzdesign",
      "en-US": "Full breathable mesh construction",
    },
    "矩形可堆叠结构": {
      "de-DE": "Stapelbares rechteckiges Design",
      "en-US": "Stackable rectangular design",
    },
    "单鞋独立收纳": {
      "de-DE": "Separates Fach für ein Paar Schuhe",
      "en-US": "Dedicated storage for one pair of shoes",
    },
  };
  return dictionary[text]?.[language] ?? text;
}

function localizedCategory(language: ListingLanguage) {
  return language === "de-DE" ? "Reise-Packwürfel-Set" : "Travel Packing Organizer Set";
}

function localizedMaterialValue(product: ProductPassport, language: ListingLanguage) {
  if (language === "en-US") return product.material;
  const germanMaterials: Record<string, string> = {
    "100D recycled ripstop nylon with DWR finish": "100D recyceltes Ripstop-Nylon mit DWR-Ausrüstung",
    "100D recycled ripstop nylon": "100D recyceltes Ripstop-Nylon",
    "Polyester ripstop with water-repellent coating": "Ripstop-Polyester mit wasserabweisender Beschichtung",
    "Polyester ripstop": "Ripstop-Polyester",
    "Recycled polyester mesh": "Netzgewebe aus recyceltem Polyester",
    "Nylon twill": "Nylon-Twill",
    "210D nylon": "210D-Nylon",
    "Coated polyester": "Beschichtetes Polyester",
    "70D ripstop nylon": "70D-Ripstop-Nylon",
    "Polyester mesh": "Polyester-Netzgewebe",
    "Coated recycled polyester": "Beschichtetes recyceltes Polyester",
  };
  return germanMaterials[product.material] ?? product.material;
}

function localizedMaterial(product: ProductPassport, language: ListingLanguage) {
  const material = localizedMaterialValue(product, language);
  if (language === "de-DE") return `Material laut Hersteller: ${material}`;
  return `Merchant-listed material: ${material}`;
}

function evidenceClaims(product: ProductPassport, language: ListingLanguage): EvidenceBackedClaim[] {
  const evidenceById = new Map(product.evidence.map((evidence) => [evidence.id, evidence]));
  return product.claims.map((claim) => {
    const evidence = claim.evidenceIds
      .map((id) => evidenceById.get(id))
      .filter((item) => item !== undefined);
    return {
      id: claim.id,
      text: localizedClaim(claim.text, language),
      kind: claim.kind,
      evidenceIds: claim.evidenceIds,
      evidenceLabels: evidence.map((item) => item.label),
      verified: claim.supported && evidence.length === claim.evidenceIds.length && evidence.every((item) => item.trusted),
    };
  });
}

function orderedClaims(claims: EvidenceBackedClaim[], plan?: ListingPlan) {
  if (!plan) return claims;
  const byId = new Map(claims.map((claim) => [claim.id, claim]));
  const planned = plan.claimOrder
    .map((id) => byId.get(id))
    .filter((claim) => claim !== undefined);
  const included = new Set(planned.map((claim) => claim.id));
  return [...planned, ...claims.filter((claim) => !included.has(claim.id))];
}

function buildTitle(
  product: ProductPassport,
  brief: LaunchBrief,
  claims: EvidenceBackedClaim[],
  preferredClaimId?: string,
) {
  const safeClaims = claims.filter((claim) => claim.verified && !unsafeClaimPattern.test(claim.text));
  const safeClaim = safeClaims.find((claim) => claim.id === preferredClaimId) ?? safeClaims[0];
  const suffix = safeClaim?.text ?? localizedCategory(brief.language);
  return `${brandName(product)} ${localizedCategory(brief.language)}, ${suffix}`;
}

function buildBullets(
  product: ProductPassport,
  brief: LaunchBrief,
  claims: EvidenceBackedClaim[],
) {
  const shipping = product.shipping.find((rule) => rule.country === brief.market);
  const verifiedClaims = claims.filter((claim) => claim.verified && !unsafeClaimPattern.test(claim.text));
  const bullets = [
    ...verifiedClaims.map((claim) => claim.text),
    localizedMaterial(product, brief.language),
  ];
  if (shipping) {
    bullets.push(
      brief.language === "de-DE"
        ? `Lieferung nach Deutschland in ${shipping.deliveryDays} Tagen; Rückgabe innerhalb von ${shipping.returnsDays} Tagen`
        : `Ships within ${shipping.deliveryDays} days; ${shipping.returnsDays}-day return window`,
    );
  }
  bullets.push(
    brief.language === "de-DE"
      ? `SKU ${product.sku}; Bestand vor dem Kauf erneut prüfen`
      : `SKU ${product.sku}; recheck live inventory before purchase`,
  );
  return bullets.slice(0, platformRules[brief.platform].bulletMax);
}

function buildChecks(
  product: ProductPassport,
  brief: LaunchBrief,
  title: string,
  bullets: string[],
  description: string,
  searchTerms: string[],
  attributes: ListingDraft["attributes"],
  claims: EvidenceBackedClaim[],
): PlatformCheck[] {
  const rules = platformRules[brief.platform];
  const shipping = product.shipping.find((rule) => rule.country === brief.market);
  const allClaimsVerified = claims.length > 0 && claims.every((claim) => claim.verified);
  const hasUnsafeClaim = [title, ...bullets, ...claims.map((claim) => claim.text)].some((text) =>
    unsafeClaimPattern.test(text),
  );
  const searchTermBytes = new TextEncoder().encode(searchTerms.join(" ")).length;
  const uniqueSearchTerms = new Set(searchTerms.map((term) => term.trim().toLowerCase()));
  const requiredAttributeLabels = ["SKU", "品类", "材质", "目标市场"];
  const localeMatchesMarket = (brief.market === "DE" && brief.language === "de-DE")
    || (brief.market === "US" && brief.language === "en-US");
  const platformFormat = brief.platform === "amazon"
    ? {
        passed: searchTermBytes <= 249 && uniqueSearchTerms.size === searchTerms.length,
        detail: `Search Terms ${searchTermBytes}/249 Bytes，且不得重复`,
      }
    : brief.platform === "shopify"
      ? {
          passed: description.length >= 100 && description.length <= 500,
          detail: `商品描述 ${description.length}/100-500 个字符`,
        }
      : {
          passed: !/[#@]|https?:\/\//i.test(title) && title.length >= 25,
          detail: "标题不得包含 Hashtag、账号或外部链接，且至少 25 个字符",
        };
  return [
    {
      id: "title-length",
      label: "标题长度",
      passed: title.length <= rules.titleMax,
      severity: "blocking",
      detail: `${title.length}/${rules.titleMax} 个字符`,
    },
    {
      id: "bullet-count",
      label: "卖点数量",
      passed: bullets.length >= rules.bulletMin && bullets.length <= rules.bulletMax,
      severity: "warning",
      detail: `${bullets.length} 条，平台要求 ${rules.bulletMin}-${rules.bulletMax} 条`,
    },
    {
      id: "claim-evidence",
      label: "卖点来源",
      passed: allClaimsVerified,
      severity: "blocking",
      detail: allClaimsVerified ? "每条商品卖点都能找到来源" : "部分商品卖点缺少可信来源",
    },
    {
      id: "unsupported-claim",
      label: "高风险表述",
      passed: !hasUnsafeClaim,
      severity: "blocking",
      detail: hasUnsafeClaim ? "发现无证据认证或绝对化表述" : "未发现无证据认证或绝对化表述",
    },
    {
      id: "market-shipping",
      label: "目标市场配送",
      passed: Boolean(shipping),
      severity: "blocking",
      detail: shipping ? `${shipping.deliveryDays} 天送达，${shipping.returnsDays} 天退货` : `不支持配送至 ${marketLabels[brief.market]}`,
    },
    {
      id: "inventory",
      label: "可售库存",
      passed: product.stock > 0,
      severity: "blocking",
      detail: product.stock > 0 ? `${product.stock} 件可售` : "当前库存为 0",
    },
    {
      id: "source-version",
      label: "商品资料版本",
      passed: product.version > 0,
      severity: "warning",
      detail: `基于 Product Passport v${product.version}`,
    },
    {
      id: "required-fields",
      label: "必填字段",
      passed: Boolean(description.trim())
        && searchTerms.length > 0
        && requiredAttributeLabels.every((label) => attributes.some((attribute) => attribute.label === label && attribute.value.trim())),
      severity: "blocking",
      detail: "标题、卖点、描述、Search Terms、SKU、品类、材质和市场均需完整",
    },
    {
      id: "locale-market",
      label: "语言与市场",
      passed: localeMatchesMarket,
      severity: "blocking",
      detail: localeMatchesMarket ? `${brief.market} 使用 ${brief.language}` : "输出语言与目标市场不匹配",
    },
    {
      id: "platform-format",
      label: `${platformLabels[brief.platform]} 内容规范`,
      passed: platformFormat.passed,
      severity: "blocking",
      detail: platformFormat.detail,
    },
  ];
}

export function generateListingDraft(
  product: ProductPassport,
  brief: LaunchBrief,
  plan?: ListingPlan,
  model: string | null = null,
): ListingDraft {
  const claims = orderedClaims(evidenceClaims(product, brief.language), plan);
  const title = buildTitle(product, brief, claims, plan?.titleClaimId);
  const bullets = buildBullets(product, brief, claims);
  const safeClaims = claims.filter((claim) => claim.verified && !unsafeClaimPattern.test(claim.text));
  const detailed = plan?.descriptionTone !== "concise";
  const description = brief.language === "de-DE"
    ? `${brandName(product)} wurde aus der freigegebenen Produktquelle erstellt. ${safeClaims.map((claim) => claim.text).join(". ")}.${detailed ? ` ${localizedMaterial(product, brief.language)}.` : ""} Preis, Bestand und Lieferzeit werden vor dem Kauf erneut geprüft.`
    : `${brandName(product)} was generated from the approved product source. ${safeClaims.map((claim) => claim.text).join(". ")}.${detailed ? ` ${localizedMaterial(product, brief.language)}.` : ""} Price, inventory, and delivery are rechecked before purchase.`;
  const baseSearchTerms = brief.language === "de-DE"
    ? ["packwürfel", "reise organizer", "koffer organizer", brandName(product).toLowerCase()]
    : ["packing cubes", "travel organizer", "luggage organizer", brandName(product).toLowerCase()];
  const requestedSearchTerms = plan?.searchTermOrder
    .map((index) => baseSearchTerms[index])
    .filter((term) => term !== undefined) ?? [];
  const includedTerms = new Set(requestedSearchTerms);
  const searchTerms = [...requestedSearchTerms, ...baseSearchTerms.filter((term) => !includedTerms.has(term))];
  const attributes = [
    { label: "SKU", value: product.sku, source: "商家商品表" },
    { label: "品类", value: localizedCategory(brief.language), source: "上新任务" },
    { label: "材质", value: localizedMaterialValue(product, brief.language), source: product.evidence[0]?.label ?? "Product Passport" },
    { label: "目标市场", value: marketLabels[brief.market], source: "上新任务" },
  ];
  const checks = buildChecks(
    product,
    brief,
    title,
    bullets,
    description,
    searchTerms,
    attributes,
    claims,
  );
  const passed = checks.filter((check) => check.passed).length;
  const blockingFailed = checks.some((check) => !check.passed && check.severity === "blocking");
  const warningFailed = checks.some((check) => !check.passed && check.severity === "warning");

  return {
    id: `listing-${product.id}-${brief.platform}-${brief.market}-v${product.version + 1}`,
    productId: product.id,
    sourceVersion: product.version,
    outputVersion: product.version + 1,
    platform: brief.platform,
    market: brief.market,
    language: brief.language,
    title,
    bullets,
    description,
    searchTerms,
    attributes,
    claims,
    checks,
    score: Math.round((passed / checks.length) * 100),
    status: blockingFailed ? "blocked" : warningFailed ? "review" : "ready",
    generation: {
      mode: plan ? "qwen-assisted" : "deterministic",
      model: plan ? model : null,
      plan: plan ?? null,
    },
  };
}

export function applyListingDraft(catalog: ProductPassport[], draft: ListingDraft) {
  return catalog.map((product) => {
    if (product.id !== draft.productId) return structuredClone(product);
    const claimsById = new Map(draft.claims.map((claim) => [claim.id, claim]));
    return {
      ...structuredClone(product),
      title: draft.title,
      subtitle: `${platformLabels[draft.platform]} · ${marketLabels[draft.market]} · 可追溯 Listing`,
      claims: product.claims.map((claim) => ({
        ...claim,
        text: claimsById.get(claim.id)?.text ?? claim.text,
      })),
      version: draft.outputVersion,
    };
  });
}
