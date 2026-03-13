'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [empresa, setEmpresa] = useState('cdc');
    const [usuario, setUsuario] = useState('cdc');
    const [senha, setSenha] = useState('cdc#%¨&¨&*5842585');
    const { login, isLoading, error, isAuthenticated, initialLoading } = useAuth();

    // Se já estiver autenticado, redirecionar para dashboard
    useEffect(() => {
        if (isAuthenticated && !initialLoading) {
            router.push('/dashboard');
        }
    }, [isAuthenticated, initialLoading, router]);

    if (initialLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Verificando sessão...</span>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const success = await login(empresa, usuario, senha);
        if (success) router.push('/dashboard');
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <div className="w-full max-w-sm space-y-6">
                <div className="text-center space-y-2">
                    <div className="mx-auto flex h-50 w-50 items-center justify-center font-bold text-primary-foreground text-lg">
                        <img
                            src="/logo.png"
                            alt="CDC + EZPoint Logo"
                            className="h-50 w-50 object-contain"
                        />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground">CDC + EZPoint</h1>
                    <p className="text-sm text-muted-foreground">Entre com suas credenciais para acessar o painel</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="empresa">Empresa</Label>
                        <Input
                            id="empresa"
                            type="text"
                            placeholder="cdc"
                            value={empresa}
                            onChange={(e) => setEmpresa(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="usuario">Usuário</Label>
                        <Input
                            id="usuario"
                            type="text"
                            placeholder="cdc"
                            value={usuario}
                            onChange={(e) => setUsuario(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="senha">Senha</Label>
                        <Input
                            id="senha"
                            type="password"
                            placeholder="••••••••"
                            value={senha}
                            onChange={(e) => setSenha(e.target.value)}
                            required
                        />
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Entrar
                    </Button>
                </form>
            </div>
        </div>
    );
}