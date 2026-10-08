import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Frame — Votre produit en mouvement', description: 'Studio local de motion design pour les produits SaaS.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
