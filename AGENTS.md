# Project rules
- Implement HPP as an authenticated React page using the existing menu permission registry, so access stays consistent with the rest of the application.
- Keep HPP calculations and CSV parsing in its dedicated library and persist a single shared workspace in Lovable Cloud with version-checked updates and server-enforced menu permissions, so all accounts use the same HPP data without changing inventory.
- Serve fixed HPP CSV templates from public/downloads through a shared download control, so input forms deliver same-origin files without browser generation.