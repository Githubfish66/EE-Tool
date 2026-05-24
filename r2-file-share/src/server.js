import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { google } from "googleapis";
import { load_config } from "./config.js";
import { sanitize_filename, validate_drive_file_id, validate_upload_request } from "./validation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

function create_oauth_client(config) {
	const oauth_client = new google.auth.OAuth2(
		config.google.client_id,
		config.google.client_secret,
		config.google.redirect_uri
	);

	if (config.google.refresh_token) {
		oauth_client.setCredentials({
			refresh_token: config.google.refresh_token
		});
	}

	return oauth_client;
}

function get_request_base_url(request, configured_base_url) {
	if (configured_base_url) {
		return configured_base_url;
	}

	return `${request.protocol}://${request.get("host")}`;
}

function get_auth_url(oauth_client) {
	return oauth_client.generateAuthUrl({
		access_type: "offline",
		prompt: "consent",
		scope: [DRIVE_SCOPE]
	});
}

async function get_access_token(oauth_client) {
	try {
		const token_response = await oauth_client.getAccessToken();
		if (!token_response.token) {
			throw new Error("Unable to obtain Google access token");
		}

		return token_response.token;
	} catch (error) {
		if (error.response?.data?.error === "invalid_grant" || error.message === "invalid_grant") {
			const auth_error = new Error("Google Drive authorization expired or is invalid. Please visit /auth/google and replace GOOGLE_REFRESH_TOKEN.");
			auth_error.status_code = 409;
			throw auth_error;
		}

		throw error;
	}
}

async function make_file_public(oauth_client, file_id) {
	const drive = google.drive({
		version: "v3",
		auth: oauth_client
	});

	await drive.permissions.create({
		fileId: file_id,
		requestBody: {
			type: "anyone",
			role: "reader"
		}
	});

	const file_response = await drive.files.get({
		fileId: file_id,
		fields: "id,name,webViewLink,webContentLink"
	});

	return file_response.data;
}

function create_download_page_url(request, config, file_id) {
	const base_url = get_request_base_url(request, config.public_base_url);
	const url = new URL("/", base_url);
	url.searchParams.set("file", file_id);
	return url.toString();
}

function verify_upload_password(request, config) {
	const upload_password = request.body?.upload_password;
	return typeof upload_password === "string" && upload_password === config.security.upload_password;
}

export function create_app(config = load_config(), oauth_client = create_oauth_client(config)) {
	const app = express();
	const public_dir = path.resolve(__dirname, "..", "public");

	app.set("trust proxy", 1);
	app.use(helmet({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				scriptSrc: ["'self'", "https://cdn.tailwindcss.com"],
				styleSrc: ["'self'", "'unsafe-inline'"],
				connectSrc: ["'self'", "https://www.googleapis.com", "https://*.googleapis.com"],
				imgSrc: ["'self'", "data:"],
				objectSrc: ["'none'"]
			}
		}
	}));
	app.use(express.json({ limit: "32kb" }));
	app.use(rateLimit({
		windowMs: 60 * 1000,
		limit: 60,
		standardHeaders: true,
		legacyHeaders: false
	}));

	app.get("/health", (_request, response) => {
		response.json({ ok: true });
	});

	app.get("/auth/google", (_request, response) => {
		response.redirect(get_auth_url(oauth_client));
	});

	app.get("/oauth2callback", async (request, response, next) => {
		try {
			const code = request.query.code;
			if (typeof code !== "string") {
				response.status(400).send("Missing OAuth code");
				return;
			}

			const token_response = await oauth_client.getToken(code);
			const refresh_token = token_response.tokens.refresh_token;
			if (!refresh_token) {
				response.status(400).send("Google did not return a refresh token. Revoke the app permission, then visit /auth/google again.");
				return;
			}

			response.type("html").send(`<!doctype html>
				<html lang="zh-Hant">
					<head><meta charset="utf-8"><title>Google Drive 授權完成</title></head>
					<body style="font-family: system-ui; line-height: 1.6; max-width: 760px; margin: 40px auto; padding: 0 20px;">
						<h1>Google Drive 授權完成</h1>
						<p>請把下面這行加入 Render Environment Variables 或本機 .env。這個 token 只顯示一次，請不要公開分享。</p>
						<pre style="white-space: pre-wrap; background: #111827; color: #f9fafb; padding: 16px; border-radius: 8px;">GOOGLE_REFRESH_TOKEN=${refresh_token}</pre>
						<p>加好後重新啟動服務。</p>
					</body>
				</html>`);
		} catch (error) {
			console.error("Failed to complete Google OAuth callback", error);
			next(error);
		}
	});

	app.get("/api/auth/status", (_request, response) => {
		response.json({
			ready: Boolean(config.google.refresh_token),
			auth_url: "/auth/google"
		});
	});

	app.post("/api/uploads/session", async (request, response, next) => {
		try {
			if (!verify_upload_password(request, config)) {
				response.status(401).json({ error: "Invalid upload password" });
				return;
			}

			if (!config.google.refresh_token) {
				response.status(409).json({
					error: "Google Drive authorization is required",
					auth_url: "/auth/google"
				});
				return;
			}

			const validation = validate_upload_request(request.body, config.limits.max_file_size_bytes);
			if (!validation.ok) {
				response.status(validation.status).json({ error: validation.message });
				return;
			}

			const access_token = await get_access_token(oauth_client);
			response.json({
				access_token,
				init_url: "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink,webContentLink",
				metadata: {
					name: validation.filename
				},
				upload_headers: {
					"content-type": "application/json; charset=UTF-8",
					"x-upload-content-type": validation.content_type,
					"x-upload-content-length": String(validation.file_size)
				},
				file_headers: {
					"content-type": validation.content_type
				},
				expires_in: config.limits.upload_session_expires_seconds
			});
		} catch (error) {
			console.error("Failed to create Google Drive upload session", error);
			next(error);
		}
	});

	app.post("/api/files/share", async (request, response, next) => {
		try {
			if (!config.google.refresh_token) {
				response.status(409).json({
					error: "Google Drive authorization is required",
					auth_url: "/auth/google"
				});
				return;
			}

			const file_id = request.body?.file_id;
			if (!validate_drive_file_id(file_id)) {
				response.status(400).json({ error: "Invalid Google Drive file ID" });
				return;
			}

			const file = await make_file_public(oauth_client, file_id);
			response.json({
				file_id: file.id,
				filename: sanitize_filename(file.name || "download"),
				drive_view_url: file.webViewLink,
				drive_download_url: file.webContentLink,
				share_page_url: create_download_page_url(request, config, file.id)
			});
		} catch (error) {
			console.error("Failed to share Google Drive file", error);
			next(error);
		}
	});

	app.get("/api/files/:file_id", async (request, response, next) => {
		try {
			if (!config.google.refresh_token) {
				response.status(409).json({
					error: "Google Drive authorization is required",
					auth_url: "/auth/google"
				});
				return;
			}

			const file_id = request.params.file_id;
			if (!validate_drive_file_id(file_id)) {
				response.status(400).json({ error: "Invalid Google Drive file ID" });
				return;
			}

			const drive = google.drive({
				version: "v3",
				auth: oauth_client
			});
			const file_response = await drive.files.get({
				fileId: file_id,
				fields: "id,name,webViewLink,webContentLink"
			});

			response.json({
				file_id: file_response.data.id,
				filename: sanitize_filename(file_response.data.name || "download"),
				drive_view_url: file_response.data.webViewLink,
				drive_download_url: file_response.data.webContentLink
			});
		} catch (error) {
			console.error("Failed to load Google Drive file metadata", error);
			next(error);
		}
	});

	app.use(express.static(public_dir));

	app.use((error, _request, response, _next) => {
		console.error("Unhandled server error", error);
		response.status(error.status_code || 500).json({
			error: error.status_code ? error.message : "Internal server error"
		});
	});

	return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const config = load_config();
	const app = create_app(config);

	app.listen(config.port, () => {
		console.log(`Drive file share server listening on port ${config.port}`);
	});
}
