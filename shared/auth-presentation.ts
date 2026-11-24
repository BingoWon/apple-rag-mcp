// Shared by the hosted authorization screen and the CLI's standalone loopback page.
export const AUTH_MARK =
	'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m5 7 5 5-5 5M13 17h6"/></svg>';
const light =
	"--ap-bg:#f7f8fa;--ap-panel:#fff;--ap-text:#182230;--ap-muted:#667085;--ap-line:#e6e9ee;--ap-soft:#f8fafc;--ap-accent:#60a5fa;--ap-accent-text:#fff;--ap-tint:#eff6ff;--ap-green:#087443;--ap-green-bg:#ecfdf3;--ap-red:#b42318;--ap-red-bg:#fef3f2;--ap-shadow:0 12px 40px -20px #18223030;";
const dark =
	"--ap-bg:#101114;--ap-panel:#191b20;--ap-text:#f0f2f5;--ap-muted:#a0a6b2;--ap-line:#2c3038;--ap-soft:#202329;--ap-accent:#8ab4ff;--ap-accent-text:#102044;--ap-tint:#222f45;--ap-green:#75d6a8;--ap-green-bg:#18362b;--ap-red:#fda29b;--ap-red-bg:#402724;--ap-shadow:0 16px 48px -24px #0008;";
export const AUTH_STYLES = `
.auth-page {
  ${light}
  box-sizing: border-box;
  min-height: 100svh;
  background: var(--ap-bg);
  color: var(--ap-text);
  font: 15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans SC",sans-serif;
  padding: 28px 32px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 32px;
  -webkit-font-smoothing:antialiased
}
.auth-page * {
  box-sizing:border-box
}
.auth-page a {
  color: inherit;
  text-decoration:none
}
.auth-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap:20px
}
.auth-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 650;
  letter-spacing:-.4px
}
.auth-brand-mark {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 1px solid var(--ap-line);
  border-radius: 9px;
  background: var(--ap-panel);
  color:var(--ap-accent)
}
.auth-brand-mark svg {
  width: 20px;
  height:20px
}
.auth-controls {
  display: flex;
  align-items: center;
  gap:8px
}
.auth-controls [class*="left-1/2"] {
  left: auto;
  right: 0;
  translate: 0 0;
  transform:none
}
.auth-center {
  width: 100%;
  display: grid;
  place-items: center;
  padding:24px 0 48px
}
.auth-card {
  width: 100%;
  max-width: 460px;
  border: 1px solid var(--ap-line);
  border-radius: 20px;
  background: var(--ap-panel);
  box-shadow: var(--ap-shadow);
  padding:36px
}
.auth-kicker {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 18px;
  color: var(--ap-muted);
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 1.6px;
  text-transform:uppercase
}
.auth-kicker::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background:var(--ap-accent)
}
.auth-title {
  font-size: 28px;
  line-height: 1.3;
  letter-spacing: -.8px;
  font-weight: 650;
  margin: 0 0 10px;
  text-wrap:balance
}
.auth-description {
  color: var(--ap-muted);
  font-size: 14px;
  line-height: 1.75;
  margin:0
}
.auth-identity {
  margin: 26px 0 22px;
  border: 1px solid var(--ap-line);
  border-radius: 12px;
  overflow:hidden
}
.auth-identity-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding:14px 16px
}
.auth-identity-row>div {
  min-width:0
}
.auth-identity-row+.auth-identity-row {
  border-top:1px solid var(--ap-line)
}
.auth-row-icon {
  color: var(--ap-muted);
  flex-shrink: 0;
  width: 18px;
  height:18px
}
.auth-identity dt {
  color: var(--ap-muted);
  font-size: 11px;
  margin:0 0 2px
}
.auth-identity dd {
  font-size: 13px;
  font-weight: 500;
  margin: 0;
  overflow-wrap:anywhere
}
.auth-permissions {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 9px;
  font-size:13px
}
.auth-permissions li {
  display: flex;
  gap: 9px;
  align-items:center
}
.auth-check {
  color: var(--ap-green);
  width: 16px;
  height: 16px;
  flex-shrink:0
}
.auth-note {
  font-size: 12px;
  color: var(--ap-muted);
  line-height: 1.65;
  margin:14px 0 0
}
.auth-code {
  margin: 22px 0;
  padding: 16px;
  text-align: center;
  background: var(--ap-soft);
  border-radius:12px
}
.auth-code strong {
  display: block;
  font: 600 24px/1.5 ui-monospace,SFMono-Regular,monospace;
  letter-spacing:3px
}
.auth-code p {
  font-size: 12px;
  color: var(--ap-muted);
  margin:6px 0 0
}
.auth-actions {
  display: flex;
  gap: 10px;
  margin-top:26px
}
.auth-page .auth-primary,.auth-page .auth-secondary {
  height: 44px;
  border-radius: 9px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  padding: 10px 16px;
  box-shadow: none;
  transform: none;
  cursor: pointer;
  transition:opacity .15s,background .15s
}
.auth-page .auth-primary {
  flex: 1;
  background: var(--ap-accent);
  color: var(--ap-accent-text);
  border:1px solid transparent
}
.auth-page .auth-secondary {
  background: var(--ap-panel);
  color: var(--ap-text);
  border:1px solid var(--ap-line)
}
.auth-page .auth-primary:hover {
  opacity: .9;
  background: var(--ap-accent);
  transform:none
}
.auth-page .auth-secondary:hover {
  background: var(--ap-soft);
  border-color: var(--ap-line);
  transform:none
}
.auth-page button:disabled {
  cursor: wait;
  opacity:.55
}
.auth-page :focus-visible {
  outline: 3px solid var(--ap-accent);
  outline-offset:4px
}
.auth-safety {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin-top: 18px;
  color: var(--ap-muted);
  font-size: 11px;
  line-height:1.7
}
.auth-safety svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  margin-top:2px
}
.auth-footer {
  display: flex;
  justify-content: center;
  gap: 18px;
  color: var(--ap-muted);
  font-size:11px
}
.auth-footer a:hover {
  text-decoration:underline
}
.auth-status {
  text-align: center;
  padding:8px 0
}
.auth-status-icon {
  width: 60px;
  height: 60px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  color: var(--ap-green);
  background: var(--ap-green-bg);
  margin:0 auto 24px
}
.auth-status-icon svg {
  width: 28px;
  height:28px
}
.auth-status-icon[data-tone=error] {
  color: var(--ap-red);
  background:var(--ap-red-bg)
}
.auth-status-icon[data-tone=neutral] {
  color: var(--ap-accent);
  background:var(--ap-tint)
}
.auth-status .auth-description {
  max-width: 320px;
  margin:0 auto
}
.auth-status .auth-actions {
  justify-content:center
}
.auth-status .auth-primary {
  flex: initial;
  min-width:180px
}
.auth-command {
  margin: 22px 0 0;
  padding: 12px 16px;
  background: var(--ap-soft);
  border: 1px solid var(--ap-line);
  border-radius: 10px;
  font: 12px/1.6 ui-monospace,SFMono-Regular,monospace;
  overflow-wrap:anywhere
}
.auth-page form {
  margin-top:24px
}
.auth-field-label {
  display: block;
  font-size: 12px;
  font-weight: 550;
  margin-bottom:7px
}
.auth-loading {
  min-height: 240px;
  display: grid;
  place-content: center;
  text-align: center;
  gap: 12px;
  color: var(--ap-muted);
  font-size:13px
}
.auth-spinner {
  width: 22px;
  height: 22px;
  margin: auto;
  border: 2px solid var(--ap-line);
  border-top-color: var(--ap-accent);
  border-radius: 50%;
  animation:auth-spin .7s linear infinite
}
@keyframes auth-spin {
  to {
    transform:rotate(360deg)
  }
}
@media(prefers-color-scheme:dark) {
  .auth-page {
    ${dark}
  }
}
:root.dark .auth-page {
  ${dark}
}
:root.light .auth-page {
  ${light}
}
@media(max-width:520px) {
  .auth-page {
    padding: 20px 20px 24px;
    gap:24px
  }
  .auth-center {
    padding:8px 0 24px
  }
  .auth-card {
    padding: 28px 24px;
    border-radius:16px
  }
  .auth-title {
    font-size:25px
  }
  .auth-top {
    gap:12px
  }
  .auth-controls {
    gap:4px
  }
}
@media(prefers-reduced-motion:reduce) {
  .auth-spinner {
    animation:none
  }
  .auth-page * {
    transition:none!important
  }
}
`;
