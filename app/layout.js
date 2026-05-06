// app/layout.js
import './globals.css';
import Providers from './providers';

export const metadata = {
  title: 'CRUD Dungeon',
  description: 'Aprenda CRUD jogando — Next.js 16 + MySQL + Kaplay',
  manifest: '/manifest.json',
  // EDUCATIONAL: explicit icons override Next.js default favicon.ico auto-detect.
  // logo.png é a marca nova; appleWebApp também aponta pra ela.
  icons: {
    icon: [{ url: '/logo.png', type: 'image/png' }],
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'CRUD Dungeon',
    startupImage: '/logo.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#020617',
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
