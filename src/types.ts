export interface StatusUpdate {
  id: number;
  project_id: number;
  status_date: string;
  note: string;
}

export interface StageLog {
  id: number;
  project_id: number;
  stage: string;
  changed_at: string;
}

export interface Category {
  id: number;
  name: string;
  is_active: number; // 0 or 1
}

export interface ProjectGroup {
  id: number;
  name: string;
}

export interface Project {
  id: number;
  category: string;
  app_name: string;
  current_status: string;
  group_id?: number;
  group_name?: string;
  updates: StatusUpdate[];
  stageLogs: StageLog[];
  analysis_session_date?: string;
  brd_submission_date?: string;
  brd_review_date?: string;
  dev_session_date?: string;
  development_start?: string;
  development_end?: string;
  demo_start?: string;
  demo_end?: string;
  uat_start?: string;
  uat_end?: string;
  deployment_start?: string;
  deployment_end?: string;
  go_live_start?: string;
  go_live_end?: string;
}
