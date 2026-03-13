'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Verificar se já está logado
    const token = localStorage.getItem('token');
    const timestamp = localStorage.getItem('loginTimestamp');

    if (token && timestamp) {
      const agora = Date.now();
      const diffHoras = (agora - parseInt(timestamp)) / (1000 * 60 * 60);

      if (diffHoras < 24) {
        router.push('/dashboard');
      } else {
        // Token expirado, limpar
        localStorage.removeItem('token');
        localStorage.removeItem('empresa');
        localStorage.removeItem('usuario');
        localStorage.removeItem('loginTimestamp');
        router.push('/login');
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Redirecionando...</p>
    </div>
  );
}