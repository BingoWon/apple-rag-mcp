import { LoginForm } from "@/components/forms/LoginForm";

export const metadata = {
	title: "Sign In | Apple RAG MCP",
	description: "Sign in to your Apple RAG MCP account to access your dashboard and API keys.",
};

export default function LoginPage() {
	return <LoginForm />;
}
