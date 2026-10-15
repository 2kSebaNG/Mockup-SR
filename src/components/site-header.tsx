import { Link } from "@tanstack/react-router";
import { Grid2X2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link to="/" className="brand"><span className="brand-mark">X</span><div><div className="brand-name">ECOSISTEMA X</div><div className="brand-caption">GESTIÓN CONECTADA</div></div></Link>
        <Button variant="charcoal"><Grid2X2 />Módulos</Button>
        <div className="account"><span className="avatar">SN</span><span className="account-email">snunez@aecon.cl</span><Button variant="charcoal"><LogOut />Salir</Button></div>
      </div>
    </header>
  );
}
