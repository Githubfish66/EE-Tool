import test from "node:test";
import assert from "node:assert/strict";
import { sanitize_filename, validate_drive_file_id, validate_upload_request } from "../src/validation.js";

test("sanitize_filename removes unsafe path characters", () => {
	assert.equal(sanitize_filename("../secret:report?.zip"), ".._secret_report_.zip");
	assert.equal(sanitize_filename(""), "download");
});

test("validate_upload_request accepts valid upload metadata", () => {
	const result = validate_upload_request({
		filename: "archive.zip",
		content_type: "application/zip",
		file_size: 1024
	}, 2048);

	assert.equal(result.ok, true);
	assert.equal(result.filename, "archive.zip");
	assert.equal(result.content_type, "application/zip");
	assert.equal(result.file_size, 1024);
});

test("validate_upload_request rejects oversized files", () => {
	const result = validate_upload_request({
		filename: "archive.zip",
		content_type: "application/zip",
		file_size: 4096
	}, 2048);

	assert.equal(result.ok, false);
	assert.equal(result.status, 413);
});

test("validate_drive_file_id only accepts Google Drive-like file IDs", () => {
	assert.equal(validate_drive_file_id("1AbCdEfGhIjKlMnOpQrStUvWxYz_12345"), true);
	assert.equal(validate_drive_file_id("../archive.zip"), false);
	assert.equal(validate_drive_file_id("short"), false);
});
