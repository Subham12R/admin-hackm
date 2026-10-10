export type Theme = "light" | "dark"

export const THEME_STORAGE_KEY = "hackmatrix-admin-theme"

// Runs in <head> before first paint so the stored (or system) theme never flashes.
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"}catch(e){}})()`
