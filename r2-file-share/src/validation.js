const MAX_FILENAME_LENGTH = 180;
const SAFE_CONTENT_TYPE_PATTERN = /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*(?:; ?[a-z0-9.+-]+=[a-z0-9.+-]+)*$/iu;
const DRIVE_FILE_ID_PATTERN = /^[a-zA-Z0-9_-]{10,200}$/u;

export function sanitize_filename(filename) {
	if (typeof filename !== "string") {
		return "download";
	}

	const normalized_name = filename
		.normalize("NFKC")
		.replace(/[\\/:*?"<>|\u0000-\u001f]/gu, "_")
		.replace(/\s+/gu, " ")
		.trim();

	const safe_name = normalized_name || "download";
	return safe_name.slice(0, MAX_FILENAME_LENGTH);
}

export function validate_upload_request(body, max_file_size_bytes) {
	const filename = sanitize_filename(body?.filename);
	const content_type = typeof body?.content_type === "string" ? body.content_type.trim() : "";
	const file_size = Number(body?.file_size);

	if (!content_type || !SAFE_CONTENT_TYPE_PATTERN.test(content_type)) {
		return {
			ok: false,
			status: 400,
			message: "Invalid content_type"
		};
	}

	if (!Number.isSafeInteger(file_size) || file_size <= 0) {
		return {
			ok: false,
			status: 400,
			message: "file_size must be a positive integer"
		};
	}

	if (file_size > max_file_size_bytes) {
		return {
			ok: false,
			status: 413,
			message: "File is larger than the configured limit"
		};
	}

	return {
		ok: true,
		filename,
		content_type,
		file_size
	};
}

export function validate_drive_file_id(file_id) {
	if (typeof file_id !== "string" || !DRIVE_FILE_ID_PATTERN.test(file_id)) {
		return false;
	}

	return true;
}
