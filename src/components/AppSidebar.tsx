'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Users,
    ClipboardList,
    BarChart3,
    Plug,
    Settings,
    UserCircle,
    Clock,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Interjornada', icon: Clock, path: '/interjornada' }
];

interface AppSidebarProps {
    collapsed: boolean;
    onToggle: () => void;
    mobileOpen: boolean;
    onMobileClose: () => void;
}

export default function AppSidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: AppSidebarProps) {
    const pathname = usePathname();

    return (
        <>
            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-foreground/30 lg:hidden"
                    onClick={onMobileClose}
                />
            )}

            <aside
                className={cn(
                    'fixed top-0 left-0 z-50 flex h-screen flex-col bg-sidebar text-sidebar-foreground transition-all duration-300',
                    collapsed ? 'w-16' : 'w-60',
                    mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                )}
            >
                {/* Logo */}
                <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white font-bold text-accent-foreground text-sm">
                        <img
                            src="/logo.png"
                            alt="CDC"
                            className="h-10 w-10 object-contain"
                        />
                    </div>
                    {!collapsed && (
                        <span className="whitespace-nowrap font-semibold text-sidebar-primary text-sm tracking-wide">
                            CDC EZPoint
                        </span>
                    )}
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto px-2 py-3">
                    <ul className="space-y-1">
                        {menuItems.map((item) => {
                            const active = pathname === item.path;
                            return (
                                <li key={item.path}>
                                    <Link
                                        href={item.path}
                                        onClick={onMobileClose}
                                        className={cn(
                                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                                            active
                                                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                                                : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-primary'
                                        )}
                                    >
                                        <item.icon className="h-5 w-5 shrink-0" />
                                        {!collapsed && <span>{item.label}</span>}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* Collapse toggle - desktop only */}
                <button
                    onClick={onToggle}
                    className="hidden lg:flex h-10 items-center justify-center border-t border-sidebar-border text-sidebar-foreground hover:text-sidebar-primary transition-colors"
                >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
            </aside>
        </>
    );
}