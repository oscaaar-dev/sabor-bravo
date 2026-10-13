export interface NavLink {
  readonly href: string;
  readonly label: string;
  /** Etiqueta corta para anchos entre lg y xl. */
  readonly short?: string;
}

export const NAV_LINKS: readonly NavLink[] = [
  { href: "#funcionalidades", label: "Funcionalidades" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#demos", label: "Restaurantes demo", short: "Demos" },
  { href: "#planes", label: "Planes" },
];

export const LOGIN_HREF = "/login";
export const SIGNUP_HREF = "/registro";
