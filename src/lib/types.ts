/** The shapes of TaskFlow's data. Everything in here has already been through `sanitize`. */

export type StatusId = 'todo' | 'doing' | 'review' | 'done';
export type Priority = 'low' | 'medium' | 'high';

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  at: number;
}

export interface LogEntry {
  at: number;
  text: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: StatusId;
  priority: Priority;
  /** Local `YYYY-MM-DD`, or '' for no due date. */
  due: string;
  /** Member id, or '' for unassigned. */
  assignee: string;
  project: string;
  tags: string[];
  subtasks: Subtask[];
  comments: Comment[];
  log: LogEntry[];
  createdAt: number;
  completedAt: number | null;
}

export interface Project {
  id: string;
  name: string;
  color: string;
}

/** The whole document: what localStorage holds in local mode and a workspace holds in cloud mode. */
export interface Doc {
  projects: Project[];
  tasks: Task[];
}

export interface Member {
  id: string;
  name: string;
  color: string;
}
