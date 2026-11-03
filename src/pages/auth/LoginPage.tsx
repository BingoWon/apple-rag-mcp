import { LoginForm } from "@/components/forms/LoginForm";

export const metadata = {
	title: "Sign In | Apple RAG",
	description: "Sign in to your Apple RAG account to manage your agent connections and account.",
};

export default function LoginPage() {
	return <LoginForm />;
}
