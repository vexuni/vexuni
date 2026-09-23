/** API contracts matching src/app.ts + sdk/index.ts responses. */

export interface User {
  id: string;
  username: string;
  admin?: boolean;
  display_name?: string;
  bio?: string;
  created_at?: number | string;
  totp_enabled?: boolean;
}

export interface Repository {
  id: string;
  namespace: string;
  name: string;
  description?: string;
  visibility: "public" | "private";
  default_branch: string;
  created_at?: number | string;
  owner_id?: string;
  workspace_id?: string | null;
  archived_at?: number | null;
  base_repo?: unknown;
  stars?: number;
  forks?: number;
  forked_from?: string | null;
  fork_source?: string | null;
  role?: string;
  clone_url?: string;
  starred?: boolean;
  watching?: boolean;
}

export interface TreeEntry {
  name: string;
  sha: string;
  type: "blob" | "tree" | "commit";
  mode: string;
}

export interface Tree {
  ref: string;
  path: string;
  entries: TreeEntry[];
}

export interface Blob {
  ref: string;
  path: string;
  size: number;
  binary: boolean;
  content: string | null;
}

export interface CommitItem {
  sha: string;
  author: string;
  date: string;
  message: string;
}

export interface Branch {
  name: string;
  sha: string;
}

export interface Tag {
  name: string;
  sha: string;
  message?: string;
}

export interface Issue {
  id: number;
  repo_id?: string;
  title: string;
  body?: string;
  state: "open" | "closed" | string;
  author?: string;
  assignee?: string | null;
  milestone?: string | null;
  milestone_id?: string | null;
  revision?: number;
  created_at?: number | string;
  updated_at?: number | string;
  closed_at?: number | string | null;
  labels?: Label[];
  comments?: Comment[];
  comment_count?: number;
}

export interface Label {
  id: string;
  name: string;
  color?: string;
}

export interface Comment {
  id: number;
  body: string;
  author?: string;
  created_at?: number | string;
}

export interface MergeRequest {
  id: number;
  title: string;
  body?: string;
  state: "open" | "merged" | "closed" | string;
  /** DB columns are source/target; source_namespace+source_name mark forks. */
  source: string;
  target: string;
  source_namespace?: string | null;
  source_name?: string | null;
  author?: string;
  created_at?: number | string;
  merged_sha?: string | null;
}

export interface CIRun {
  id: string | number;
  status: "queued" | "running" | "success" | "failure" | "cancelled" | string;
  ref?: string;
  sha?: string;
  event?: string;
  created_at?: number | string;
  started_at?: number | string;
  finished_at?: number | string;
  title?: string;
}

export interface PackageItem {
  id: string;
  name: string;
  ecosystem?: string;
  kind?: string;
  latest?: string;
  versions?: number;
  updated_at?: number | string;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  created_at?: number | string;
}

export interface Member {
  username: string;
  role?: string;
  user_id?: string;
}

export interface Token {
  id: string;
  name?: string;
  scopes?: string[];
  created_at?: number | string;
  last_used_at?: number | string;
  expires_at?: number | string;
}

export interface Workspace {
  id: string;
  slug: string;
  name?: string;
  role?: string;
  member_count?: number;
  created_at?: number | string;
}

export interface Notification {
  id: string | number;
  type?: string;
  title?: string;
  repo?: string;
  namespace?: string;
  repo_name?: string;
  url?: string;
  read?: boolean;
  read_at?: number | string | null;
  created_at?: number | string;
}

export interface RepoURL {
  id: string;
  url: string;
  ephemeral_url?: string;
  import_url?: string;
}

export interface SearchHit {
  kind?: string;
  path?: string;
  line?: number;
  text?: string;
  namespace?: string;
  repo?: string;
  name?: string;
  title?: string;
  id?: number;
  description?: string;
}

export interface Social {
  stars: number;
  starred: number | boolean;
  watching: number | boolean;
}

export interface Profile {
  profile: {
    id: string;
    username: string;
    created_at?: number | string;
    display_name?: string;
    bio?: string;
    location?: string;
    website?: string;
  };
  repositories: Repository[];
  activity: {
    id: number;
    action: string;
    detail?: string;
    created_at?: number | string;
    namespace: string;
    name: string;
  }[];
  next: number | null;
}

export interface WorkspaceDetail {
  id: string;
  slug: string;
  name?: string;
  description?: string;
  role?: string;
  member_count?: number;
  created_at?: number | string;
}

export interface Release {
  id: string;
  tag: string;
  sha?: string;
  title: string;
  body?: string;
  prerelease?: number | boolean;
  author?: string;
  created_at?: number | string;
}

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  state?: string;
  total?: number;
  closed?: number;
  due_date?: string | null;
}

export interface MergeDiscussion {
  id: number | string;
  author?: string;
  body: string;
  created_at?: number | string;
  resolved?: number | boolean;
  kind?: string;
  path?: string | null;
  line?: number | null;
  revision?: number;
}

export interface MergeDetail extends MergeRequest {
  author_id?: string;
  source_sha?: string;
  target_sha?: string;
  source_repo_id?: string | null;
  revision?: number;
  diff?: string;
  discussions?: MergeDiscussion[];
  discussions_next?: number | string | null;
  closing_issues?: { id: number; title: string; state?: string }[];
  gate?: {
    allowed?: boolean;
    reasons?: string[];
    approvals?: number;
    changes?: number;
    unresolved?: number;
    reviews?: MergeReview[];
    ci?: { status?: string; required?: boolean } | null;
    rule?: unknown;
    codeowners?: unknown;
  } | null;
  stale?: boolean;
}

export interface MergeReview {
  user_id?: string;
  username?: string;
  verdict: string;
  body?: string;
  created_at?: number | string;
}
