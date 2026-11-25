import { load, save } from "./lib.js";

// Connexion locale de démonstration (aucun serveur) : profil stocké dans le navigateur.
export const getUser = () => load("nukun.user", null);
export const setUser = (u) => save("nukun.user", u);
export const logout = () => save("nukun.user", null);

// Demandes de prêt partagées entre l'espace commerçant et l'espace établissement
export const getLoans = () => load("nukun.loans", []);
export function upsertLoan(loan) {
  const list = getLoans().filter((l) => l.id !== loan.id);
  list.unshift(loan); save("nukun.loans", list.slice(0, 50));
  const mine = load("nukun.loan", null);
  if (mine && mine.id === loan.id) save("nukun.loan", loan);
}
