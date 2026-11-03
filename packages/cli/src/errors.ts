export class CLIError extends Error {
	constructor(
		readonly code: string,
		message: string,
		readonly exitCode = 1,
	) {
		super(message);
	}
}

export function statusExitCode(status: number): number {
	return status === 401 ? 3 : status === 429 ? 4 : status === 404 ? 5 : status === 400 ? 2 : 1;
}
