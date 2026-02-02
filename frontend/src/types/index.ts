// Shared TypeScript types

export interface DataQualityIssue {
  column?: string;
  check: string;
  severity: "warning" | "error" | "info";
  message: string;
  value?: unknown;
}

export interface DataQualityReport {
  issues: DataQualityIssue[];
  overall_score: number;
}

export interface Recommendation {
  action: string;
  rationale: string;
  expected_impact: string;
  confidence: number;
  priority: "high" | "medium" | "low";
}

export interface StatResult {
  test_name: string;
  statistic?: number;
  p_value?: number;
  interpretation: string;
  details: Record<string, unknown>;
}

export interface ChatResponse {
  session_id: string;
  answer: string;
  generated_sql?: string;
  generated_code?: string;
  chart_url?: string;
  stats?: StatResult;
  data_quality?: DataQualityReport;
  recommendations: Recommendation[];
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  generated_sql?: string;
  generated_code?: string;
  chart_url?: string;
  recommendations: Recommendation[];
  data_quality?: DataQualityReport;
  stats?: StatResult;
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  datasource_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}

// Datasources
export interface Datasource {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  ssl_mode: string;
  is_default: boolean;
  created_at: string;
}

export interface DatasourceCreate {
  name: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl_mode: string;
  is_default: boolean;
}

// Schema
export interface ColumnInfo {
  name: string;
  data_type: string;
  nullable: boolean;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  references?: string;
}

export interface TableInfo {
  name: string;
  schema_name: string;
  row_count?: number;
  columns: ColumnInfo[];
}

export interface InferredRelation {
  from_table: string;
  from_column: string;
  to_table: string;
  to_column: string;
  confidence: number;
  relation_type: "explicit" | "inferred";
}

export interface SchemaMap {
  datasource_id: string;
  tables: TableInfo[];
  relations: InferredRelation[];
}

// Alerts
export interface Alert {
  id: string;
  name: string;
  datasource_id?: string;
  query: string;
  cron_expression: string;
  threshold_condition: string;
  webhook_url?: string;
  enabled: boolean;
  last_triggered_at?: string;
  created_at: string;
}

export interface AlertCreate {
  name: string;
  datasource_id?: string;
  query: string;
  cron_expression: string;
  threshold_condition: string;
  webhook_url?: string;
  enabled: boolean;
}

// Glossary
export interface GlossaryTerm {
  id: string;
  term: string;
  sql_expression: string;
  description?: string;
  created_at: string;
}

export interface GlossaryTermCreate {
  term: string;
  sql_expression: string;
  description?: string;
}

// Admin / Observability
export interface LLMLog {
  id: string;
  model: string;
  prompt_length?: number;
  response_length?: number;
  tokens_used?: number;
  latency_ms?: number;
  error?: string;
  created_at: string;
}

export interface QueryLog {
  id: string;
  datasource_id?: string;
  sql: string;
  rows_returned?: number;
  duration_ms?: number;
  error?: string;
  created_at: string;
}
