# Drive File Share

Temporary large-file sharing service for Render Free + Google Drive. The
backend never receives the file body. It handles Google OAuth and returns a
short-lived access token. The browser creates the Google Drive resumable upload
session itself, then uploads directly to Google Drive with progress.

## Project Structure

```text
r2-file-share/
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── src/
│   ├── config.js
│   ├── server.js
│   └── validation.js
├── test/
│   └── validation.test.js
├── .env.example
├── package.json
├── render.yaml
└── README.md
```

## Google Cloud Setup

1. Create a Google Cloud project.
2. Enable Google Drive API.
3. Configure Google Auth Platform.
4. Create an OAuth client:
   - Application type: Web application
   - Authorized JavaScript origin: `http://localhost:3000`
   - Authorized redirect URI: `http://localhost:3000/oauth2callback`
5. For Render, add these after deployment:
   - Authorized JavaScript origin: `https://your-service.onrender.com`
   - Authorized redirect URI: `https://your-service.onrender.com/oauth2callback`

Use the least-privilege Drive scope:

```text
https://www.googleapis.com/auth/drive.file
```

## Local Setup

```bash
cd r2-file-share
npm install
copy .env.example .env
npm start
```

Fill `.env`:

```env
PORT=3000
NODE_ENV=development
PUBLIC_BASE_URL=http://localhost:3000

GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
GOOGLE_REFRESH_TOKEN=

UPLOAD_PASSWORD=change-this-upload-password

MAX_FILE_SIZE_BYTES=5368709120
UPLOAD_SESSION_EXPIRES_SECONDS=900
```

Then open:

```text
http://localhost:3000/auth/google
```

After approving access, copy the displayed `GOOGLE_REFRESH_TOKEN` into `.env`
and restart the server.

## Render Environment Variables

Set these in Render Dashboard -> Web Service -> Environment:

| Key | Required | Example / Notes |
|---|---:|---|
| `NODE_ENV` | Yes | `production` |
| `PUBLIC_BASE_URL` | Yes | `https://your-service.onrender.com` |
| `GOOGLE_CLIENT_ID` | Yes | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Yes | `https://your-service.onrender.com/oauth2callback` |
| `GOOGLE_REFRESH_TOKEN` | Yes | Token produced after visiting `/auth/google` |
| `UPLOAD_PASSWORD` | Yes | Private password required before uploads |
| `MAX_FILE_SIZE_BYTES` | No | Default `5368709120` (5 GiB) |
| `UPLOAD_SESSION_EXPIRES_SECONDS` | No | Default `900` |

Render settings:

```text
Root Directory: r2-file-share
Build Command: npm ci
Start Command: npm start
```

## API

### `GET /auth/google`

Starts OAuth authorization and requests offline Google Drive access.

### `GET /oauth2callback`

Exchanges the OAuth code and prints a `GOOGLE_REFRESH_TOKEN` line. Store that
value in `.env` or Render Environment Variables.

### `POST /api/uploads/session`

Request:

```json
{
	"filename": "backup.zip",
	"content_type": "application/zip",
	"file_size": 1048576,
	"upload_password": "private upload password"
}
```

Response:

```json
{
	"access_token": "short_lived_google_access_token",
	"init_url": "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink,webContentLink",
	"metadata": {
		"name": "backup.zip"
	},
	"upload_headers": {
		"content-type": "application/json; charset=UTF-8",
		"x-upload-content-type": "application/zip",
		"x-upload-content-length": "1048576"
	},
	"file_headers": {
		"content-type": "application/zip"
	},
	"expires_in": 900
}
```

The browser must create the resumable upload session. If the backend creates it
server-side, Google Drive can omit the CORS headers required for the browser to
read the final upload response.

### `POST /api/files/share`

Request:

```json
{
	"file_id": "google_drive_file_id"
}
```

Response:

```json
{
	"file_id": "google_drive_file_id",
	"filename": "backup.zip",
	"drive_view_url": "https://drive.google.com/file/d/...",
	"drive_download_url": "https://drive.google.com/uc?id=...",
	"share_page_url": "https://your-service.onrender.com/?file=..."
}
```

## Security Notes

- Do not put Google OAuth secrets in frontend code.
- The frontend receives a short-lived Google access token so it can create the
  Drive resumable upload session in the browser. Keep this service private or
  add an upload password before public use.
- `UPLOAD_PASSWORD` is required before issuing upload authorization. Use a long
  private phrase and share it only with people who should upload files to your
  Drive.
- Keep the app in Testing mode with your Gmail as a test user if this is only
  for personal use.
- Anyone with the generated share link can open the file because the app sets
  the Drive permission to `anyone` + `reader`.
- For public production use, add authentication or an upload password before
  issuing upload sessions.
