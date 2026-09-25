// GitHub Pages has no SPA rewrites: a reload on /paper-reader/paper/<slug> would 404.
// Serving the app itself as the 404 page lets react-router take over that URL.
import { copyFileSync } from "node:fs";

copyFileSync("dist/index.html", "dist/404.html");
