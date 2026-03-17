import { useAuthStore } from "@/stores/auth";

export function useAuth() {
	return useAuthStore();
}
