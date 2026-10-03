// Browser checks reuse a running server; say so plainly instead of failing every test.
const port = process.env.MERCATURE_PORT ?? '4173';
try {
  await fetch(`http://127.0.0.1:${port}/`);
} catch {
  console.error(`Nothing is serving Mercature on port ${port}. Start npm run dev or npm run preview, or set MERCATURE_PORT.`);
  process.exit(1);
}
