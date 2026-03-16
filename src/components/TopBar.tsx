'use client';

import { Menu, Search, Bell, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface TopBarProps {
    onMenuClick: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
    const { empresa, logout } = useAuth();
    const router = useRouter();

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    return (
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-card px-4 lg:px-6">
            <button
                onClick={onMenuClick}
                className="lg:hidden text-muted-foreground hover:text-foreground transition-colors"
            >
                <Menu className="h-5 w-5" />
            </button>

            <span className="hidden sm:block text-sm font-semibold text-foreground">CDC + EZPoint Dashboard</span>

            <div className="ml-auto flex items-center gap-3">
                <div className="flex items-center gap-2 border-l pl-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {empresa?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span className="hidden sm:block text-sm font-medium text-foreground">{empresa}</span>
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="text-muted-foreground hover:text-destructive hover:bg-primary/10"
                >
                    <LogOut className="h-4 w-4" />
                </Button>
            </div>
        </header>
    );
}