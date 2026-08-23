export type NotificationCategory = "operations" | "project" | "schedule" | "finance" | "workforce" | "compliance" | "communication" | "system";
export type NotificationSeverity = "info" | "success" | "warning" | "critical";

export type BosNotification = {
  id: string;
  company_id: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  linked_href: string | null;
  source_module: string;
  requested_channels: string[];
  delivery_state: string;
  in_app_status: "ready" | "read" | "archived";
  push_status: string;
  email_status: string;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationsPayload = {
  ok: boolean;
  error?: string;
  userId?: string;
  notifications: BosNotification[];
  unreadCount: number;
};
