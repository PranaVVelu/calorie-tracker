'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/app/AppContext';

// Legacy /log route: open the logging sheet over Today.
export default function LogRedirect() {
    const router = useRouter();
    const { openLogger } = useApp();
    useEffect(() => {
        router.replace('/');
        openLogger();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
}
