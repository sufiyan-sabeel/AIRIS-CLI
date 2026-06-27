import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  { ignores: [".next/**", "out/**", "node_modules/**"] },
  ...nextVitals,
  ...nextTs,
];

export default eslintConfig;
