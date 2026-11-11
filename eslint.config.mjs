import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  { ignores: [".keystone/**", ".next/**", "node_modules/**", "migrations/**"] },
];

export default eslintConfig;
