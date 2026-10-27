export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>La página no cargó</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@700&display=swap" />
    <style>
      body { font: 15px/1.5 "Barlow", system-ui, sans-serif; background: oklch(0.965 0.002 270); color: oklch(0.22 0.008 260); display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font: 700 2.25rem/1.1 "Barlow Condensed", system-ui, sans-serif; margin: 0 0 0.5rem; }
      p { color: oklch(0.52 0.01 260); margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.25rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: oklch(0.56 0.225 25); color: oklch(1 0 0); }
      .secondary { background: oklch(1 0 0); color: oklch(0.22 0.008 260); border-color: oklch(0.62 0.012 260); }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>La página no cargó</h1>
      <p>Algo falló de nuestro lado. Intenta recargar o vuelve al inicio.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Reintentar</button>
        <a class="secondary" href="/">Volver al inicio</a>
      </div>
    </div>
  </body>
</html>`;
}
