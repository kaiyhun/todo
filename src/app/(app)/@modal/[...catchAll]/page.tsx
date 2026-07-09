/**
 * Closes the modal on *soft* navigations to routes the `@modal` slot doesn't
 * intercept (e.g. clicking a sidebar link while a task modal is open).
 *
 * Without this catch-all, Next keeps the slot's last matched state alive on
 * client-side navigation and the modal would linger. `default.tsx` alone only
 * covers hard loads.
 */
export default function ModalCatchAll() {
  return null;
}
