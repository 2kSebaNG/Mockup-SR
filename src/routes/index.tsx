import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Folder, Pause, Play, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({ meta: [
    { title: "Bienvenida | Ecosistema X" },
    { name: "description", content: "Bienvenida al Ecosistema X. Gestión conectada y accesos a solicitudes y chat interno." },
    { property: "og:title", content: "Bienvenida | Ecosistema X" },
    { property: "og:description", content: "Gestión conectada: todas las áreas en un mismo ecosistema." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
});

const departments = ["Finanzas", "Contabilidad", "Abastecimiento", "Bodega", "Logística", "Personas", "Seguridad", "Estudios", "Oficina Técnica", "Planificación", "Seguridad", "Recursos Humanos", "Calidad", "Supervisión"];

function Index() {
  const [playing, setPlaying] = useState(true);
  const [slide, setSlide] = useState(3);
  return (
    <AppShell trail={["Inicio"]}>
      <div className="welcome">
        <p className="eyebrow">BIENVENIDO, SNUNEZ</p>
        <h1 className="page-heading">Video de bienvenida</h1>
        <p className="page-description">Conoce cómo opera la plataforma y su objetivo: conectar a la empresa a través del Ecosistema X.</p>
        <section className="presentation" aria-label="Presentación de bienvenida">
          <div className="presentation-stage">
            <div><p className="eyebrow">RESPALDO</p><h2 className="slide-heading">Cada área guarda su información</h2><p className="slide-description">Detrás de todas las áreas existen carpetas que guardan la información que se genera día a día. Todo queda respaldado y disponible solo para los correos autorizados.</p></div>
            <div className="department-grid">
              <div className="department folder"><Folder size={16} />CARPETA</div><div className="department folder"><Folder size={16} />CARPETA</div><div />
              {departments.map((name, index) => <div className="department" key={`${name}-${index}`}>{name}</div>)}
            </div>
          </div>
          <div className="presentation-controls">
            <Button size="icon" aria-label={playing ? "Pausar presentación" : "Reproducir presentación"} onClick={() => setPlaying(!playing)}>{playing ? <Pause /> : <Play />}</Button>
            <Button variant="on-surface" size="icon" aria-label="Siguiente diapositiva" onClick={() => setSlide(slide === 6 ? 1 : slide + 1)}><SkipForward /></Button>
            <div className="progress-tracks">{Array.from({ length: 6 }, (_, i) => <div key={i} className={`progress-track ${i < slide - 1 ? "complete" : i === slide - 1 ? "current" : ""}`} />)}</div>
            <span className="slide-count">{slide} / 6</span>
          </div>
        </section>
        <section className="next-section"><p className="eyebrow">CONSULTA EJECUTIVA</p><h2>La información, conectada.</h2><p>Un mismo ecosistema para todas las áreas de la empresa.</p></section>
      </div>
    </AppShell>
  );
}
