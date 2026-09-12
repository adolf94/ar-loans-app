import { useEffect, useState } from 'react';

export const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 639px)');
        const onChange = () => setIsMobile(mq.matches);
        onChange();
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);
    return isMobile;
}
