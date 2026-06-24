export interface Theme {
  name: string;
  command: string;
  preview: string;
}

export const themes: Theme[] = [
  { name: "graphite", command: "airis theme set graphite", preview: "#3d4653" },
  { name: "dark", command: "airis theme set dark", preview: "#1e1e2e" },
  { name: "light", command: "airis theme set light", preview: "#eff1f5" },
  { name: "amoled", command: "airis theme set amoled", preview: "#000000" },
  { name: "nord", command: "airis theme set nord", preview: "#2e3440" },
  { name: "dracula", command: "airis theme set dracula", preview: "#282a36" },
  { name: "gruvbox", command: "airis theme set gruvbox", preview: "#282828" },
  { name: "tokyo-night", command: "airis theme set tokyo-night", preview: "#1f2335" },
  { name: "catppuccin", command: "airis theme set catppuccin", preview: "#1e1e2e" },
  { name: "monokai", command: "airis theme set monokai", preview: "#272822" },
  { name: "solarized-dark", command: "airis theme set solarized-dark", preview: "#002b36" },
  { name: "one-dark", command: "airis theme set one-dark", preview: "#282c34" },
  { name: "rose-pine", command: "airis theme set rose-pine", preview: "#191724" },
  { name: "matrix", command: "airis theme set matrix", preview: "#0d0208" },
  { name: "amber", command: "airis theme set amber", preview: "#1a1400" },
  { name: "classic", command: "airis theme set classic", preview: "#1a1a2e" },
  { name: "minimal", command: "airis theme set minimal", preview: "#111111" },
  { name: "warm", command: "airis theme set warm", preview: "#1f1a14" },
];
