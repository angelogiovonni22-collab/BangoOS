export type PhaseListItem = {
  id: string;
  name: string;
  color: string | null;
  progress: number;
  taskCount: number;
  completedTaskCount: number;
};

export type TaskListItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  plannedFinish: string | null;
  completionPercentage: number;
  assignedProfileId: string | null;
  assignedProfileLabel: string;
  sortOrder: number;
  taskNumber: number;
};

export type TaskFormValues = {
  title: string;
  description: string;
  status: string;
  priority: string;
  estimatedHours: string;
  actualHours: string;
  plannedStart: string;
  plannedFinish: string;
  actualStart: string;
  actualFinish: string;
  completionPercentage: string;
};
