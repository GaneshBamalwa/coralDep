Meridian Extension

How to load the extension in Chrome or Edge (unpacked):

1.  Build or run the frontend application via the Vite development server. Default development URL: `http://localhost:5173/`.
2.  Open Chrome or Edge and navigate to `chrome://extensions/`.
3.  Enable "Developer mode" in the top-right corner.
4.  Click "Load unpacked" and select this folder: `contextos/frontend/extension`.
5.  Click the extension icon to open the popup. Use the navigation buttons to open specific panels in the application (these append a `?panel=` query parameter to the URL).

Notes:
- The popup attempts to fetch `https://coraldep.onrender.com/api/health` to show backend status.
- If your Vite dev server runs on a different port, update `APP_BASE` in `popup.js`.
