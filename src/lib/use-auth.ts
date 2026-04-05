"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getToken, setToken, clearToken } from "./api-client";
import type { User, AuthResponse } from "@/types";

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const token = getToken();
      if (!token) return null;
      try {
        const res = await apiRequest<{ user: User }>("/api/auth/me");
        return res.user;
      } catch {
        clearToken();
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  async function login(email: string, password: string) {
    const res = await apiRequest<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(res.token);
    queryClient.setQueryData(["auth-user"], res.user);
    return res.user;
  }

  async function register(email: string, password: string, name: string) {
    const res = await apiRequest<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    setToken(res.token);
    queryClient.setQueryData(["auth-user"], res.user);
    return res.user;
  }

  function logout() {
    clearToken();
    queryClient.setQueryData(["auth-user"], null);
    queryClient.clear();
  }

  return { user: user ?? null, isLoading, login, register, logout };
}
