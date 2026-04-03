# Privacy Policy — Memos – Private Notes

**Last updated:** April 3, 2026

## Overview

Memos – Private Notes is a browser extension that connects to your self-hosted Memos server. Your privacy is important to us. This policy explains what data the extension accesses, how it is used, and how it is stored.

## Data Collection

This extension does **not** collect, track, or send any data to third parties. There are no analytics, no telemetry, and no external services involved.

## Data Stored Locally

The extension stores the following data locally in your browser using `chrome.storage.local`:

- **Memos server URL** — the address of your self-hosted Memos server
- **Access token** — used to authenticate API requests to your server
- **User preferences** — theme (dark/light), editor mode, and display mode settings

This data never leaves your browser and is only used to communicate with your configured Memos server.

## Network Requests

The extension makes API requests **only** to the Memos server URL that you configure. No other servers or endpoints are contacted. All communication uses the HTTPS protocol as configured by your server.

## Permissions

- **Storage** — to save your settings and credentials locally in the browser
- **Host permissions (all URLs)** — required because each user self-hosts Memos on their own domain, so the server address is not known in advance. The extension only connects to the single URL you provide.

## Data Sharing

No data is shared with, sold to, or transferred to any third party.

## Data Removal

You can remove all stored data at any time by:
1. Clicking the "Disconnect" button in the extension settings, or
2. Uninstalling the extension from your browser

## Open Source

This extension is open source. You can review the full source code at:
https://github.com/vitaliisili/memos-note

## Contact

If you have questions about this privacy policy, please open an issue on the GitHub repository.