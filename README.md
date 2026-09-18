# Boards ↔ Support Tickets

Chrome extension (local/dev use) that shows Fluent Support ticket details in a resizable sidebar
on FluentBoards task pages (`lounge.authlab.io`). Any `support.wpmanageninja.com/#/tickets/<id>` link found in the
task (description, comments, attachments) is fetched and displayed.

## Install

1. Open `chrome://extensions` and enable **Developer mode**.
2. **Load unpacked** → select this folder.
3. Reload the boards tab.

## Auth

Extension options offer two modes:

- **Browser login** (default) – uses your logged-in session on support.wpmanageninja.com.
- **Application password** – WP username + application password, stored in this browser only.

## Files

- `content.js` – finds ticket ids on the page, renders the sidebar
- `inject.js` – page-world hook that reads ticket links from FluentBoards task API responses
- `background.js` – authenticated calls to the Fluent Support REST API
- `options.html/js` – auth settings
- `dev-test.html` – stubbed page for UI testing (serve the folder with `python3 -m http.server`)

By Masiur
