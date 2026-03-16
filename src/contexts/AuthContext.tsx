'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    initialLoading: boolean;
    error: string | null;
    login: (empresa: string, usuario: string, senha: string) => Promise<boolean>;
    logout: () => void;
    token: string | null;
    empresa: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [isLoading, setIsLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [empresa, setEmpresa] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const checkAuth = () => {
            try {
                const storedToken = localStorage.getItem('token');
                const storedEmpresa = localStorage.getItem('empresa');
                const storedTimestamp = localStorage.getItem('loginTimestamp');

                console.log('Verificando autenticação:', {
                    hasToken: !!storedToken,
                    hasEmpresa: !!storedEmpresa,
                    hasTimestamp: !!storedTimestamp
                });

                if (storedToken && storedEmpresa && storedTimestamp) {
                    const agora = Date.now();
                    const diffHoras = (agora - parseInt(storedTimestamp)) / (1000 * 60 * 60);

                    if (diffHoras < 24) {
                        setToken(storedToken);
                        setEmpresa(storedEmpresa);
                        console.log('Token restaurado do localStorage');
                    } else {
                        console.log('Token expirado');
                        localStorage.removeItem('token');
                        localStorage.removeItem('empresa');
                        localStorage.removeItem('usuario');
                        localStorage.removeItem('loginTimestamp');
                    }
                }
            } catch (err) {
                console.error('Erro ao verificar autenticação:', err);
            } finally {
                setInitialLoading(false);
            }
        };

        checkAuth();
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

                localStorage.setItem('token', data.token);
                localStorage.setItem('empresa', empresa);
                localStorage.setItem('usuario', usuario);
                localStorage.setItem('loginTimestamp', Date.now().toString());

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

        localStorage.removeItem('token');
        localStorage.removeItem('empresa');
        localStorage.removeItem('usuario');
        localStorage.removeItem('loginTimestamp');

        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{
            isAuthenticated: !!token,
            isLoading,
            initialLoading,
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