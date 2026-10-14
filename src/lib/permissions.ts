export const ROLES = ["owner", "admin", "staff"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = { owner: "Propietario", admin: "Administrador", staff: "Personal" };

export type Permission =
  | "orders.read"
  | "orders.update"
  | "menu.write"
  | "settings.write"
  | "reports.read"
  | "team.manage";

/** Matriz de permisos. Se aplica SIEMPRE en el servidor; la interfaz solo oculta lo que no se puede hacer. */
const MATRIX: Record<Role, readonly Permission[]> = {
  owner: ["orders.read", "orders.update", "menu.write", "settings.write", "reports.read", "team.manage"],
  admin: ["orders.read", "orders.update", "menu.write", "settings.write", "reports.read"],
  staff: ["orders.read", "orders.update"],
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
