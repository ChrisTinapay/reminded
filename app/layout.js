import { Inter, Poppins } from 'next/font/google';
import './globals.css';
import ThemeScript from './_components/ThemeScript';

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
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <body className={`${inter.variable} ${poppins.variable} antialiased`}>
        <ThemeScript />
        {children}
      </body>
    </html>
  );
}
