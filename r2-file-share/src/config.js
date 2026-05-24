import dotenv from "dotenv";

dotenv.config();

const DEFAULT_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024;
const DEFAULT_UPLOAD_SESSION_EXPIRES_SECONDS = 15 * 60;

function read_integer_env(name, fallback) {
	const raw_value = process.env[name];
	if (!raw_value) {
		return fallback;
	}

	const parsed_value = Number.parseInt(raw_value, 10);
	if (!Number.isFinite(parsed_value) || parsed_value <= 0) {
		throw new Error(`${name} must be a positive integer`);
	}

	return parsed_value;
}

function normalize_public_base_url(value) {
	if (!value) {
		return "";
	}

	return value.replace(/\/+$/u, "");
}

function require_env(name) {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}

	return value;
}

export function load_config() {
	return {
		port: read_integer_env("PORT", 3000),
		node_env: process.env.NODE_ENV || "development",
		public_base_url: normalize_public_base_url(process.env.PUBLIC_BASE_URL),
		google: {
			client_id: require_env("GOOGLE_CLIENT_ID"),
			client_secret: require_env("GOOGLE_CLIENT_SECRET"),
			redirect_uri: require_env("GOOGLE_REDIRECT_URI"),
			refresh_token: process.env.GOOGLE_REFRESH_TOKEN || ""
		},
		security: {
			upload_password: require_env("UPLOAD_PASSWORD")
		},
		limits: {
			max_file_size_bytes: read_integer_env("MAX_FILE_SIZE_BYTES", DEFAULT_MAX_FILE_SIZE_BYTES),
			upload_session_expires_seconds: read_integer_env("UPLOAD_SESSION_EXPIRES_SECONDS", DEFAULT_UPLOAD_SESSION_EXPIRES_SECONDS)
		}
	};
}
