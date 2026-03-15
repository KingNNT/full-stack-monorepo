"use client";

interface IGlobalErrorProps {
	error: Error & { digest?: string };
	reset: () => void;
}

const GlobalError = ({ reset }: IGlobalErrorProps) => {
	return (
		<html lang="en">
			<body>
				<div
					style={{
						display: "flex",
						minHeight: "100vh",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						padding: "1rem",
					}}
				>
					<h2 style={{ marginBottom: "1rem", fontSize: "1.5rem", fontWeight: "bold" }}>
						Something went wrong!
					</h2>
					<button
						onClick={() => reset()}
						type="button"
						style={{
							padding: "0.5rem 1rem",
							backgroundColor: "#000",
							color: "#fff",
							border: "none",
							borderRadius: "0.25rem",
							cursor: "pointer",
						}}
					>
						Try again
					</button>
				</div>
			</body>
		</html>
	);
};

export default GlobalError;
