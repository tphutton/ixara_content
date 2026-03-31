import {
  ApprovalStatus,
  BlogStatus,
  ContentStatus,
  ContentType,
  ScheduleStatus,
  UserRole,
} from "@prisma/client";

export const userRoleOptions = Object.values(UserRole);
export const approvalStatusOptions = Object.values(ApprovalStatus);
export const contentStatusOptions = Object.values(ContentStatus);
export const contentTypeOptions = Object.values(ContentType);
export const blogStatusOptions = Object.values(BlogStatus);
export const scheduleStatusOptions = Object.values(ScheduleStatus);

export const websiteOptions = [
  "StadioMate",
  "Nollux Asia",
  "StadioPulse",
  "IxaraTech",
  "IxaraConnect",
] as const;
