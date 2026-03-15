const logger = {
	log: (...args: unknown[]): void => {
		console.log(...processArgs(args));
	},

	info: (...args: unknown[]): void => {
		console.info(...processArgs(args));
	},

	warn: (...args: unknown[]): void => {
		console.warn(...processArgs(args));
	},

	error: (...args: unknown[]): void => {
		console.error(...processArgs(args));
	},
};

const processArgs = (args: unknown[]): unknown[] =>
	args.map((arg: unknown) => {
		if (typeof arg === "object") {
			return JSON.stringify(arg);
		}
		return arg;
	});

export default logger;
