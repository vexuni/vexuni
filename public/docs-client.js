// The document URL is the explicit language choice, shared with the application.
const language = document.documentElement.lang === "en" ? "en" : "zh-CN";
try {
  localStorage.setItem("vexuni.locale", language);
} catch {}
document.cookie = `vexuni_locale=${language}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
