# Security policy

## Reporting a vulnerability

Please report security issues **privately** through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue for a suspected vulnerability.

Include the Handoff version, your platform, the feature involved, what you expected and what happened, and a minimal synthetic example. Use invented titles and links. Keep your real sidebar, exports, passwords and private URLs on your device.

## Supported versions

Security fixes go into the [latest release](https://github.com/paarths-collab/handoff/releases/latest). Update with the one-line Mac installer in the README, or download the latest release.

## How Handoff protects you

- Your sidebar is read and processed on your computer; nothing is uploaded.
- Handoff never reads passwords, cookies or browsing history.
- Inputs are size-limited and validated, links are allowlisted before they open, and bookmark exports leave out script-capable links.
- Every GitHub Action in CI and releases is pinned to a commit SHA, and release checksums are published with each release.

See the [threat model](docs/security/threat-model.md) and [security review](docs/reviews/security.md) for details.
