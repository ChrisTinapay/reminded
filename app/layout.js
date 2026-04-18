import { Inter, Poppins } from 'next/font/google';
import './globals.css';
import ThemeScript from './_components/ThemeScript';
import IosInstallModal from '../components/IosInstallModal';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata = {
  title: 'Reminded',
  description: 'Reminded is a platform that helps you remember things.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#131312" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
      </head>
      <body className={`${inter.variable} ${poppins.variable} antialiased`}>
        <ThemeScript />
        <IosInstallModal />
        {children}
      </body>
    </html>
  );
}
