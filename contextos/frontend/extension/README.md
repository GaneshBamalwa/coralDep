# Meridian Extension

[![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-v3-4285F4.svg?style=for-the-badge&logo=googlechrome)](#)

How to load the extension in Chrome or Edge (unpacked):

1.  Build or run the frontend application via the Vite development server. Default development URL: `http://localhost:5173/`.
2.  Open Chrome or Edge and navigate to `chrome://extensions/`.
3.  Enable "Developer mode" in the top-right corner.
4.  Click "Load unpacked" and select this folder: `contextos/frontend/extension`.
5.  Click the extension icon to open the popup. Use the navigation buttons to open specific panels in the application (these append a `?panel=` query parameter to the URL).

## Notes

*   The popup automatically checks `http://localhost:3001/api/health` to verify the backend status. Ensure the backend is running and accessible.
*   If your Vite development server runs on a different port, update the `APP_BASE` variable in `popup.js`.
