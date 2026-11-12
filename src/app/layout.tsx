import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/app/AppShell';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
    title: 'MacroTrack',
    description: 'Fast calorie and macro tracking with clear progress.',
};

export const viewport: Viewport = {
    themeColor: '#0f1114',
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" className={inter.variable}>
            <body>
                <AppShell>{children}</AppShell>
            </body>
        </html>
    );
}
