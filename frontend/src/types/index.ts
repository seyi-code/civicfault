export type FaultStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "resolved"
  | "rejected";

export interface FaultReport {
  id: number;
  category: string;
  confidence: number | null;
  image_url: string | null;
  description: string | null;
  status: FaultStatus;
  latitude: number;
  longitude: number;
  cluster_id: number | null;
  organization_id?: number | null;
  severity: string | null;
  upvote_count: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  hours_open?: number | null;
  is_overdue?: boolean | null;
  sla_hours?: number | null;
}

export interface FaultReportList {
  items: FaultReport[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ClusterSummary {
  cluster_id: number;
  category: string;
  report_count: number;
  dominant_status: FaultStatus;
  latitude: number;
  longitude: number;
  first_seen: string;
  last_seen: string;
  image_url: string | null;
  total_upvotes?: number;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
  visibility: string;
  plan: string;
  sla_hours: number;
  notify_phone?: string | null;
  notify_enabled?: boolean;
  brand_name?: string | null;
  primary_color?: string | null;
  logo_url?: string | null;
  custom_domain?: string | null;
}
