# Tab Mover threat model

Private URLs can carry document identifiers and access tokens. Protect titles, sidebar structure, existing tabs and local files. Inputs may come from another person, a damaged export or a local process. Dependency and download tampering are in scope. A compromised operating system or browser account is outside the trust boundary.

| Entry point | Required control | Test owner | Rules |
|---|---|---|---|
| Sidebar file | Limit bytes before reading, validate types, traverse with Map and visited IDs, cap output depth at 64. Count every tab or record its skip. | Core A2–A4 | 2,3,8,9 |
| Pack | Validate version, fields, identities and depth before rendering. Recompute counts. | Core A3 | 2,3,9,10 |
| Importer fragment | Remove fragment immediately, bound encoded and decoded size, validate the pack. Require preview and Move. | Extension A7, Verify A10 | 1,3,9,10 |
| Browser tabs and Undo | Allow absolute HTTP(S) at execution. Ask for optional permissions on use. Serialize operations and record current-session owned tab IDs. Preserve user additions to windows. | Extension A6–A10 | 2,5,10 |
| Web preview and exports | Render text nodes, escape attributes, allowlist archive links, escape less-than in embedded JSON. Enforce CSP and guard CSV cells from formula execution. | Core A5, UI B2 | 1,2,6,9,10 |
| Desktop IPC | Native grants for exact discovered or picked canonical regular files. Bound reads. Use save picker. Exclude credential stores. Launch only detected executables with one validated argument. | Desktop C1–C3 | 1,4,9,11 |
| Diagnostics and publication | Emit counts and fixed vocabulary. Use synthetic records for screenshots and traces. Check fixtures and archives for private data. Use original artwork. | Core A2/A5, site B3–B5, launch D1/D2 | 1,4,7,8 |
| Dependencies and downloads | Pin lockfiles, allowlist build scripts, audit licenses and vulnerabilities. Inspect manifests, archives and release provenance. Label unsigned builds. | Astra A0/A12/C4/C5, Security | 1,5,7,8 |

The review reports record implementation evidence separately.
