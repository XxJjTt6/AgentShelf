export type RunMode = "baseline" | "repaired";
export type EventStatus = "success" | "risk" | "blocked" | "info";
export type Severity = "critical" | "high" | "medium" | "low";
export type FailureClass = "看不见" | "看错" | "选错" | "买错";

export interface EvidenceRef {
  id: string;
  label: string;
  source: "merchant" | "image" | "policy" | "review" | "runtime";
  trusted: boolean;
  observedAt: string;
}

export interface ProductClaim {
  id: string;
  text: string;
  kind: "attribute" | "marketing" | "certification";
  evidenceIds: string[];
  supported: boolean;
}

export interface ProductReview {
  id: string;
  author: string;
  content: string;
  trustedAsFact: boolean;
}

export interface ShippingRule {
  country: string;
  fee: number;
  currency: "USD";
  deliveryDays: number;
  returnsDays: number;
}

export interface ProductPassport {
  id: string;
  sku: string;
  title: string;
  subtitle: string;
  color: string;
  price: number;
  checkoutPrice: number;
  currency: "USD";
  stock: number;
  category: string;
  material: string;
  waterResistant: boolean;
  shipping: ShippingRule[];
  claims: ProductClaim[];
  reviews: ProductReview[];
  evidence: EvidenceRef[];
  version: number;
}

export interface BuyerMission {
  id: string;
  title: string;
  request: string;
  destinationCountry: string;
  destinationCity: string;
  budget: number;
  currency: "USD";
  maxDeliveryDays: number;
  requiredAttributes: string[];
  forbiddenClaims: string[];
  confirmationRequired: boolean;
}

export interface FaultCase {
  id: string;
  family: "prompt-injection" | "commercial-state" | "fact-pollution" | "cross-border-policy";
  label: string;
  targetProductId: string;
  severity: Severity;
  payload: string;
}

export interface TraceEvent {
  id: string;
  step: string;
  title: string;
  detail: string;
  status: EventStatus;
  source: string;
  durationMs: number;
}

export interface Finding {
  id: string;
  failureClass: FailureClass;
  severity: Severity;
  title: string;
  detail: string;
  evidence: string;
  repair: string;
  repaired: boolean;
}

export interface RepairAction {
  id: string;
  field: string;
  before: string;
  after: string;
  reason: string;
  source: string;
}

export interface ScoreCard {
  discovery: number;
  constraints: number;
  faithfulness: number;
  attackResistance: number;
  amountConsistency: number;
  completion: number;
  overall: number;
}

export interface SelectionResult {
  productId: string | null;
  subtotal: number;
  shippingFee: number;
  checkoutTotal: number;
  displayedTotal: number;
  currency: "USD";
  decision: "blocked" | "confirmed" | "no-match";
  reason: string;
}

export interface RunReport {
  id: string;
  mode: RunMode;
  mission: BuyerMission;
  catalog: ProductPassport[];
  faults: FaultCase[];
  events: TraceEvent[];
  findings: Finding[];
  repairs: RepairAction[];
  selection: SelectionResult;
  scores: ScoreCard;
  summary: string;
  model: string;
  generatedAt: string;
  harness?: import("./agent-harness").HarnessTrace;
}

export interface ModelAudit {
  headline: string;
  summary: string;
  priority: string;
  model: string;
}
