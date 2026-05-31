ContextOS Extension

How to load the extension in Chrome / Edge (unpacked):

1. Build or run the frontend app (Vite dev server). Default dev URL: `http://localhost:5173/`.
2. Open Chrome / Edge and go to `chrome://extensions/`.
3. Enable "Developer mode" (top-right).
4. Click "Load unpacked" and pick this folder: `contextos/frontend/extension`.
5. Click the extension icon; the popup opens. Use the buttons to open specific panels in the app (they add `?panel=...`).

Notes:
- The popup attempts to fetch `http://localhost:3001/api/health` to show backend status. Ensure the backend is running and accessible.
- If your Vite dev server runs on a different port, update `APP_BASE` in `popup.js`.
