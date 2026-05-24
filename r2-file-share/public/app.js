const elements = {
	auth_panel: document.querySelector("#auth_panel"),
	auth_link: document.querySelector("#auth_link"),
	upload_zone: document.querySelector("#upload_zone"),
	file_input: document.querySelector("#file_input"),
	choose_button: document.querySelector("#choose_button"),
	file_panel: document.querySelector("#file_panel"),
	upload_password: document.querySelector("#upload_password"),
	file_name: document.querySelector("#file_name"),
	file_size: document.querySelector("#file_size"),
	upload_button: document.querySelector("#upload_button"),
	progress_bar: document.querySelector("#progress_bar"),
	progress_label: document.querySelector("#progress_label"),
	share_panel: document.querySelector("#share_panel"),
	share_url: document.querySelector("#share_url"),
	copy_button: document.querySelector("#copy_button"),
	download_panel: document.querySelector("#download_panel"),
	download_file_name: document.querySelector("#download_file_name"),
	download_button: document.querySelector("#download_button"),
	status_message: document.querySelector("#status_message")
};

let selected_file = null;
const params = new URLSearchParams(window.location.search);
const shared_key = params.get("file");

function set_status(message, tone = "default") {
	elements.status_message.textContent = message;
	elements.status_message.className = "mt-4 min-h-6 text-sm";
	if (tone === "error") {
		elements.status_message.classList.add("text-rose-300");
		return;
	}
	if (tone === "success") {
		elements.status_message.classList.add("text-emerald-300");
		return;
	}
	elements.status_message.classList.add("text-zinc-300");
}

function format_bytes(bytes) {
	const units = ["B", "KB", "MB", "GB", "TB"];
	let value = bytes;
	let unit_index = 0;

	while (value >= 1024 && unit_index < units.length - 1) {
		value /= 1024;
		unit_index += 1;
	}

	return `${value.toFixed(value >= 10 || unit_index === 0 ? 0 : 1)} ${units[unit_index]}`;
}

function set_progress(percent, label = "") {
	const safe_percent = Math.max(0, Math.min(100, percent));
	elements.progress_bar.style.width = `${safe_percent}%`;
	elements.progress_label.textContent = label || `${safe_percent.toFixed(0)}%`;
}

function show_file(file) {
	selected_file = file;
	elements.file_panel.classList.remove("hidden");
	elements.share_panel.classList.add("hidden");
	elements.file_name.textContent = file.name;
	elements.file_size.textContent = `${format_bytes(file.size)} · ${file.type || "application/octet-stream"}`;
	set_progress(0);
	set_status("準備好後按開始上傳。");
}

async function load_auth_status() {
	const response = await fetch("/api/auth/status");
	const payload = await response.json();
	if (!payload.ready) {
		elements.auth_panel.classList.remove("hidden");
		elements.auth_link.href = payload.auth_url || "/auth/google";
		set_status("請先完成 Google Drive 授權。");
		return false;
	}

	elements.auth_panel.classList.add("hidden");
	return true;
}

async function request_upload_session(file) {
	const response = await fetch("/api/uploads/session", {
		method: "POST",
		headers: {
			"content-type": "application/json"
		},
		body: JSON.stringify({
			filename: file.name,
			content_type: file.type || "application/octet-stream",
			file_size: file.size,
			upload_password: elements.upload_password.value
		})
	});

	const payload = await response.json();
	if (!response.ok) {
		if (payload.auth_url) {
			elements.auth_panel.classList.remove("hidden");
			elements.auth_link.href = payload.auth_url;
		}
		throw new Error(payload.error || "無法產生上傳簽名網址");
	}

	return payload;
}

function create_drive_upload_session(upload_session) {
	return new Promise((resolve, reject) => {
		const request = new XMLHttpRequest();
		request.open("POST", upload_session.init_url);
		request.setRequestHeader("authorization", `Bearer ${upload_session.access_token}`);

		for (const [header_name, header_value] of Object.entries(upload_session.upload_headers || {})) {
			request.setRequestHeader(header_name, header_value);
		}

		request.addEventListener("load", () => {
			if (request.status >= 200 && request.status < 300) {
				const upload_url = request.getResponseHeader("location");
				if (!upload_url) {
					reject(new Error("Google Drive 未回傳 upload session URL"));
					return;
				}
				resolve(upload_url);
				return;
			}
			reject(new Error(`Google Drive 建立上傳 session 失敗，HTTP ${request.status}`));
		});

		request.addEventListener("error", () => reject(new Error("建立 Google Drive upload session 時發生網路錯誤")));
		request.send(JSON.stringify(upload_session.metadata));
	});
}

function upload_with_progress(file, upload_url, file_headers) {
	return new Promise((resolve, reject) => {
		const request = new XMLHttpRequest();
		request.open("PUT", upload_url);

		for (const [header_name, header_value] of Object.entries(file_headers || {})) {
			request.setRequestHeader(header_name, header_value);
		}

		request.upload.addEventListener("progress", (event) => {
			if (!event.lengthComputable) {
				return;
			}
			set_progress((event.loaded / event.total) * 100);
		});

		request.addEventListener("load", () => {
			if (request.status >= 200 && request.status < 300) {
				set_progress(100);
				try {
					resolve(JSON.parse(request.responseText));
				} catch {
					reject(new Error("Google Drive 回傳格式無法解析"));
				}
				return;
			}
			reject(new Error(`Google Drive 上傳失敗，HTTP ${request.status}`));
		});

		request.addEventListener("error", () => reject(new Error("網路錯誤，上傳未完成")));
		request.addEventListener("abort", () => reject(new Error("上傳已取消")));
		request.send(file);
	});
}

async function share_drive_file(file_id) {
	const response = await fetch("/api/files/share", {
		method: "POST",
		headers: {
			"content-type": "application/json"
		},
		body: JSON.stringify({ file_id })
	});
	const payload = await response.json();
	if (!response.ok) {
		throw new Error(payload.error || "無法建立 Google Drive 分享連結");
	}

	return payload;
}

async function start_upload() {
	if (!selected_file) {
		set_status("請先選擇檔案。", "error");
		return;
	}

	if (!elements.upload_password.value) {
		set_status("請先輸入上傳密碼。", "error");
		elements.upload_password.focus();
		return;
	}

	try {
		elements.upload_button.disabled = true;
		elements.upload_zone.classList.add("is-disabled");
		set_status("正在取得 Google Drive 上傳授權...");
		const upload_session = await request_upload_session(selected_file);

		set_status("正在建立瀏覽器端 Google Drive upload session...");
		const upload_url = await create_drive_upload_session(upload_session);

		set_status("正在直接上傳到 Google Drive...");
		const drive_file = await upload_with_progress(selected_file, upload_url, upload_session.file_headers);

		set_progress(100, "正在建立分享權限...");
		const shared_file = await share_drive_file(drive_file.id);

		elements.share_url.value = shared_file.share_page_url || shared_file.drive_view_url;
		elements.share_panel.classList.remove("hidden");
		set_status("上傳完成，Google Drive 分享連結已產生。", "success");
	} catch (error) {
		console.error(error);
		set_status(error.message, "error");
	} finally {
		elements.upload_button.disabled = false;
		elements.upload_zone.classList.remove("is-disabled");
	}
}

async function copy_share_url() {
	await navigator.clipboard.writeText(elements.share_url.value);
	elements.copy_button.textContent = "已複製";
	setTimeout(() => {
		elements.copy_button.textContent = "複製";
	}, 1200);
}

async function load_shared_file() {
	try {
		set_status("正在讀取 Google Drive 檔案資訊...");
		const response = await fetch(`/api/files/${encodeURIComponent(shared_key)}`);
		const payload = await response.json();
		if (!response.ok) {
			throw new Error(payload.error || "無法讀取分享檔案");
		}

		elements.download_file_name.textContent = payload.filename;
		elements.download_button.href = payload.drive_download_url || payload.drive_view_url;
		elements.download_panel.classList.remove("hidden");
		set_status("檔案已就緒，可開啟 Google Drive 下載。", "success");
	} catch (error) {
		console.error(error);
		set_status(error.message, "error");
	}
}

elements.choose_button.addEventListener("click", () => elements.file_input.click());
elements.file_input.addEventListener("change", () => {
	const [file] = elements.file_input.files;
	if (file) {
		show_file(file);
	}
});
elements.upload_button.addEventListener("click", start_upload);
elements.copy_button.addEventListener("click", copy_share_url);

for (const event_name of ["dragenter", "dragover"]) {
	elements.upload_zone.addEventListener(event_name, (event) => {
		event.preventDefault();
		elements.upload_zone.classList.add("is-dragging");
	});
}

for (const event_name of ["dragleave", "drop"]) {
	elements.upload_zone.addEventListener(event_name, (event) => {
		event.preventDefault();
		elements.upload_zone.classList.remove("is-dragging");
	});
}

elements.upload_zone.addEventListener("drop", (event) => {
	const [file] = event.dataTransfer.files;
	if (file) {
		show_file(file);
	}
});

if (shared_key) {
	load_shared_file();
} else {
	load_auth_status();
}
