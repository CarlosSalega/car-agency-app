import { Role } from "@prisma/client";
import { LucideIcon } from "lucide-react";

export type NavAction = "logout";

export interface AdminNavItem {
  id: string;
  label: string;
  href?: string;
  action?: NavAction;
  icon?: LucideIcon;
  roles?: Role[];
  showInHeader?: boolean;
  showInDropdown?: boolean;
}
