'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    login: (empresa: string, usuario: string, senha: string) => Promise<boolean>;
    logout: () => void;
    token: string | null;
    empresa: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [empresa, setEmpresa] = useState<string | null>(null);
    const router = useRouter();

    // Verificar se já existe token no sessionStorage ao iniciar
    useEffect(() => {
        const storedToken = sessionStorage.getItem('token');
        const storedEmpresa = sessionStorage.getItem('empresa');
        if (storedToken) {
            setToken(storedToken);
            setEmpresa(storedEmpresa);
        }
    }, []);

    const login = async (empresa: string, usuario: string, senha: string) => {
        setIsLoading(true);
        setError(null);

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
                setToken(data.token);
                setEmpresa(empresa);
                sessionStorage.setItem('token', data.token);
                sessionStorage.setItem('empresa', empresa);
                sessionStorage.setItem('usuario', usuario);
                return true;
            } else {
                setError(data.error || 'Erro ao fazer login');
                return false;
            }
        } catch (err: any) {
            setError(err.message || 'Erro de conexão');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        setToken(null);
        setEmpresa(null);
        sessionStorage.clear();
        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{
            isAuthenticated: !!token,
            isLoading,
            error,
            login,
            logout,
            token,
            empresa
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}