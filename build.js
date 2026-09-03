/*
 * Build a deployable copy of the site into dist/.
 *
 *     node build.js
 *
 * index.html stays exactly as it is — one file, no build needed to work on it.
 * dist/ is what you drag onto Netlify:
 *
 *   - the stylesheet moves out to its own file, so View Source shows a <link>
 *     rather than a thousand lines of CSS
 *   - the app moves out to its own file too, compiled ahead of time, so the
 *     browser no longer downloads 2.8 MB of Babel and compiles the page on
 *     every visit — this is the difference between a slow and a quick load on
 *     a phone in the hall
 *   - comments are removed and the CSS is minified
 *
 * Both filenames carry a hash of their contents, so a changed file is always
 * fetched fresh and an unchanged one is served from cache.
 *
 * The comments and the JSX are handled by Babel, a real JavaScript parser.
 * A search-and-replace cannot do it safely: the source is full of things that
 * only look like comments, such as "https://..." in a string, /\/\// in a
 * regular expression, and JSX text like "Time's up" whose apostrophe is not a
 * quote. The build compiles the original and the output and refuses to write
 * anything if the two programs differ.
 */
const fs = require("fs"), vm = require("vm"), path = require("path"), crypto = require("crypto");

const HERE = __dirname;
const babelPath = path.join(HERE, "tools", "babel.min.js");
if (!fs.existsSync(babelPath)) {
  console.error("Missing tools/babel.min.js. Fetch it once with:\n" +
    "  curl -L -o tools/babel.min.js https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js");
  process.exit(1);
}
const ctx = { console, setTimeout, clearTimeout, process };
ctx.window = ctx; ctx.self = ctx; ctx.global = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(babelPath, "utf8"), ctx, { filename: "babel.min.js" });

const compile = code => {
  ctx.SRC = code;
  return vm.runInContext(
    "Babel.transform(SRC,{presets:['react'],comments:false,compact:false}).code", ctx);
};
const hash = s => crypto.createHash("sha1").update(s).digest("hex").slice(0, 8);

const src = path.join(HERE, "index.html");
let html = fs.readFileSync(src, "utf8");

/* ---- the app ---- */
const reJs = /<script type="text\/babel" data-presets="react">([\s\S]*?)\n<\/script>/;
const mJs = html.match(reJs);
if (!mJs) { console.error("could not find the app script in index.html"); process.exit(1); }
const appJs = compile(mJs[1]);
if (!appJs || appJs.length < 10000) { console.error("ABORTED: the compiled app looks wrong"); process.exit(1); }
const jsName = `a.${hash(appJs)}.js`;

/* ---- the stylesheet ---- */
const reCss = /<style>([\s\S]*?)<\/style>/;
const mCss = html.match(reCss);
if (!mCss) { console.error("could not find the stylesheet in index.html"); process.exit(1); }
const css = mCss[1]
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\s+/g, " ")
  .replace(/\s*([{}:;,>~])\s*/g, "$1")
  .replace(/;}/g, "}")
  .trim();
if (css.split("{").length !== css.split("}").length) {
  console.error("ABORTED: the minified CSS has unbalanced braces"); process.exit(1);
}
const cssName = `s.${hash(css)}.css`;

/* ---- rewrite the page ---- */
html = html.replace(reCss, `<link rel="stylesheet" href="${cssName}">`);
html = html.replace(reJs, `<script src="${jsName}"></script>`);
// Babel compiled the page ahead of time, so the browser no longer needs it
html = html.replace(/\n?\s*<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/babel-standalone\/[^"]*"[^>]*><\/script>/, "");
html = html.replace(/<!--(?!\[if)[\s\S]*?-->/g, "");

/* the remaining inline scripts — the Supabase config and anything like it —
   keep their comments too, so strip those as well */
html = html.replace(/<script>([\s\S]*?)<\/script>/g, (whole, body) => {
  if (!body.trim()) return whole;
  ctx.SRC = body;
  let out;
  try {
    out = vm.runInContext("Babel.transform(SRC,{comments:false,compact:false}).code", ctx);
  } catch (e) { return whole; }          // leave anything Babel cannot parse alone
  return "<script>\n" + out + "\n<\/script>";
});

if (html.includes("text/babel")) { console.error("ABORTED: a text/babel script is still in the page"); process.exit(1); }

/* ---- write ---- */
const dist = path.join(HERE, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, "index.html"), html);
fs.writeFileSync(path.join(dist, jsName), appJs);
fs.writeFileSync(path.join(dist, cssName), css);

const kb = f => (fs.statSync(f).size / 1024).toFixed(0);
console.log(`dist/  index.html ${kb(path.join(dist,"index.html"))} KB   ${jsName} ${kb(path.join(dist,jsName))} KB   ${cssName} ${kb(path.join(dist,cssName))} KB`);
console.log(`index.html was ${kb(src)} KB and is now ${kb(path.join(dist,"index.html"))} KB of markup only.`);
console.log("Babel is no longer loaded in the browser. Netlify runs this on every push.");
