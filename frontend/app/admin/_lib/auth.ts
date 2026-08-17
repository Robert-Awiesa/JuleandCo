import { api } from "./api";

export interface AdminSession {
  _id: string;
  name: string;
  email: string;
  role: string;
}

export function loginAdmin(email: string, password: string) {
  return api.post<AdminSession>("/auth/login", { email, password });
}

export function logoutAdmin() {
  return api.post<{ message: string }>("/auth/logout", {});
}
