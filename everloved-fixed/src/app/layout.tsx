import type { Metadata } from 'next';
import { Merriweather, Nunito } from 'next/font/google';
import './globals.css';
import NavBar from '@/components/Navigation/NavBar';
import ErrorBoundary from '@/components/UI/ErrorBoundary';

const merriweather = Merriweather({
  subsets: ['latin'],
  weight: ['300', '400', '700', '900'],
  variable: '--font-serif',
});

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'EverLoved',
  description: 'A Digital Sanctuary for Dementia Care',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${nunito.className} ${merriweather.variable}`}>
        <ErrorBoundary>
          <NavBar />
          <main>{children}</main>
        </ErrorBoundary>
      </body>
    </html>
  );
}
