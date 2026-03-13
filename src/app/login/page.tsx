'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [empresa, setEmpresa] = useState('cdc');
    const [usuario, setUsuario] = useState('cdc');
    const [senha, setSenha] = useState('cdc#%¨&¨&*5842585');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch('/api/proxy-login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ empresa, usuario, senha })
            });

            const data = await response.json();

            if (data.token) {
                // Salvar token e redirecionar IMEDIATAMENTE
                sessionStorage.setItem('token', data.token);
                sessionStorage.setItem('empresa', empresa);
                sessionStorage.setItem('usuario', usuario);

                // Redirecionar sem esperar mais nada
                router.push('/dashboard');
            } else {
                setError(data.error || 'Erro ao fazer login');
                setIsLoading(false);
            }
        } catch (err: any) {
            setError(err.message || 'Erro de conexão');
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <div className="w-full max-w-sm space-y-6">
                <div className="text-center space-y-2">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground text-lg">
                        CDC
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