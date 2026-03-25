import type { Env } from "../../shared/types.js";
import type { User } from "./index";

export interface ContextVariables {
	user: User;
	userId: string;
	permissions: string[];
	plan_type: string;
	mcpToken: string;
}

export interface AppEnv {
	Bindings: Env;
	Variables: ContextVariables;
}
