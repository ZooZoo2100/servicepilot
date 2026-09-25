// Vercel's public entry point cannot instantiate a paid planner or write a database file.
export { publicDemoApp as default } from "../src/server/public-demo.js";
