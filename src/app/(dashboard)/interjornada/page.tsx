'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Funcionario } from '@/services/ezpointApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Loader2,
    AlertCircle,
    Calendar,
    Clock,
    Moon,
    Sun,
    AlertTriangle,
    CheckCircle2
} from 'lucide-react';
import { format, subMonths } from 'date-fns';

const ITENS_POR_PAGINA = 20;

interface EspelhoDia {
    data: string;
    horasTrabalhadasDiurnas: string;
    horasTrabalhadasNoturnas: string;
    batidas?: string | string[]; // Pode vir como string ou array
    interjornada: string;
    horario?: string;
}

interface AnaliseInterjornada {
    funcionario: Funcionario;
    dias: EspelhoDia[];
    totalHorasDiurnas: number;
    totalHorasNoturnas: number;
    diasComExcesso: number;
    diasComJornadaNoturna: number;
    mediaInterjornada: string;
}

export default function InterjornadaPage() {
    const { isAuthenticated, token, empresa } = useAuth();
    const router = useRouter();

    const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
    const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<string>('');
    const [analise, setAnalise] = useState<AnaliseInterjornada | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingFuncionarios, setLoadingFuncionarios] = useState(true);
    const [error, setError] = useState('');

    // Filtros de data
    const [dataInicio, setDataInicio] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
    const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));

    // Carregar lista de funcionários
    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        carregarFuncionarios();
    }, [isAuthenticated, router]);

    const carregarFuncionarios = async () => {
        if (!token || !empresa) return;

        setLoadingFuncionarios(true);
        try {
            const url = `/api/funcionarios?token=${encodeURIComponent(token)}&empresa=${encodeURIComponent(empresa)}&ocultarDemitidos=true`;
            const response = await fetch(url);
            const data = await response.json();
            setFuncionarios(data.listaDeFuncionarios || []);
        } catch (err) {
            console.error('Erro ao carregar funcionários:', err);
            setError('Erro ao carregar lista de funcionários');
        } finally {
            setLoadingFuncionarios(false);
        }
    };

    const analisarInterjornada = useCallback(async () => {
        if (!token || !empresa || !funcionarioSelecionado) return;

        setLoading(true);
        setError('');
        setAnalise(null);

        try {
            const funcionario = funcionarios.find(f => String(f.id) === String(funcionarioSelecionado));
            if (!funcionario) {
                throw new Error(`Funcionário com ID ${funcionarioSelecionado} não encontrado`);
            }

            const url = `/api/espelho-ponto?token=${encodeURIComponent(token)}&empresa=${encodeURIComponent(empresa)}&idFuncionario=${funcionarioSelecionado}&dataInicio=${dataInicio}&dataFim=${dataFim}`;

            const response = await fetch(url);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Erro HTTP: ${response.status}`);
            }

            // Processar os dados
            const dias = data.dias || [];

            let totalDiurnas = 0;
            let totalNoturnas = 0;
            let diasExcesso = 0;
            let diasNoturnos = 0;
            let somaInterjornada = 0;
            let diasComInterjornada = 0;

            dias.forEach((dia: EspelhoDia) => {
                const diurnas = converterHoraParaMinutos(dia.horasTrabalhadasDiurnas || '00:00');
                const noturnas = converterHoraParaMinutos(dia.horasTrabalhadasNoturnas || '00:00');
                const totalDia = diurnas + noturnas;

                totalDiurnas += diurnas;
                totalNoturnas += noturnas;

                if (totalDia > 600) {
                    diasExcesso++;
                }

                if (noturnas > 0) {
                    diasNoturnos++;
                }

                const inter = converterHoraParaMinutos(dia.interjornada || '00:00');
                if (inter > 0) {
                    somaInterjornada += inter;
                    diasComInterjornada++;
                }
            });

            const mediaInterjornada = diasComInterjornada > 0
                ? formatarMinutosParaHora(Math.round(somaInterjornada / diasComInterjornada))
                : '00:00';

            setAnalise({
                funcionario,
                dias,
                totalHorasDiurnas: totalDiurnas,
                totalHorasNoturnas: totalNoturnas,
                diasComExcesso: diasExcesso,
                diasComJornadaNoturna: diasNoturnos,
                mediaInterjornada
            });

        } catch (err: any) {
            console.error('Erro na análise:', err);
            setError(err.message || 'Erro ao analisar dados');
        } finally {
            setLoading(false);
        }
    }, [token, empresa, funcionarioSelecionado, dataInicio, dataFim, funcionarios]);

    // Utilitários
    const converterHoraParaMinutos = (hora: string): number => {
        if (!hora || hora === '00:00') return 0;
        const [h, m] = hora.split(':').map(Number);
        return h * 60 + m;
    };

    const formatarMinutosParaHora = (minutos: number): string => {
        const horas = Math.floor(minutos / 60);
        const mins = Math.round(minutos % 60);
        return `${horas.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    const formatarData = (dataStr: string) => {
        try {
            const [dia, mes, ano] = dataStr.split('/');
            return `${dia}/${mes}/${ano}`;
        } catch {
            return dataStr;
        }
    };

    // 🔥 Função para processar batidas (pode vir como string ou array)
    const formatarBatidas = (batidas: string | string[] | undefined): string => {
        if (!batidas) return '-';
        if (Array.isArray(batidas)) {
            return batidas.join(' - ');
        }
        // Se for string, assume que é espaço separado
        return batidas.split(' ').join(' - ');
    };

    const getStatusExcesso = (diurnas: string, noturnas: string) => {
        const total = converterHoraParaMinutos(diurnas) + converterHoraParaMinutos(noturnas);
        if (total > 600) {
            return { cor: 'text-destructive', icone: AlertTriangle, texto: 'Excesso (>10h)' };
        } else if (total === 600) {
            return { cor: 'text-green-600', icone: CheckCircle2, texto: 'Exato (10h)' };
        } else {
            return { cor: 'text-blue-600', icone: Clock, texto: `${formatarMinutosParaHora(total)}h` };
        }
    };

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-foreground">Análise de Interjornada</h1>
            </div>

            {/* Filtros */}
            <div className="bg-card rounded-lg border border-border p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-foreground mb-1">
                            Funcionário
                        </label>
                        <select
                            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2"
                            value={funcionarioSelecionado}
                            onChange={(e) => setFuncionarioSelecionado(e.target.value)}
                            disabled={loadingFuncionarios}
                        >
                            <option value="">Selecione um funcionário</option>
                            {funcionarios.map((f) => (
                                <option key={f.id} value={f.id}>
                                    {f.matricula} - {f.nome}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                            Data Início
                        </label>
                        <Input
                            type="date"
                            value={dataInicio}
                            onChange={(e) => setDataInicio(e.target.value)}
                            max={dataFim}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                            Data Fim
                        </label>
                        <Input
                            type="date"
                            value={dataFim}
                            onChange={(e) => setDataFim(e.target.value)}
                            min={dataInicio}
                            max={format(new Date(), 'yyyy-MM-dd')}
                        />
                    </div>
                </div>

                <div className="mt-4 flex justify-end">
                    <Button
                        onClick={analisarInterjornada}
                        disabled={!funcionarioSelecionado || loading}
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Analisar
                    </Button>
                </div>
            </div>

            {error && (
                <div className="bg-destructive/10 text-destructive p-4 rounded-lg border border-destructive/20">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        <span>{error}</span>
                    </div>
                </div>
            )}

            {/* Resultados da Análise */}
            {analise && analise.dias.length > 0 ? (
                <div className="space-y-6">
                    {/* Cards de Resumo */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-card rounded-lg border p-6">
                            <div className="flex items-center gap-3">
                                <Sun className="h-5 w-5 text-yellow-500" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Horas Diurnas</p>
                                    <p className="text-2xl font-semibold">
                                        {formatarMinutosParaHora(analise.totalHorasDiurnas)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-card rounded-lg border p-6">
                            <div className="flex items-center gap-3">
                                <Moon className="h-5 w-5 text-blue-500" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Horas Noturnas</p>
                                    <p className="text-2xl font-semibold">
                                        {formatarMinutosParaHora(analise.totalHorasNoturnas)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-card rounded-lg border p-6">
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Dias com Excesso</p>
                                    <p className="text-2xl font-semibold text-destructive">
                                        {analise.diasComExcesso}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-card rounded-lg border p-6">
                            <div className="flex items-center gap-3">
                                <Clock className="h-5 w-5 text-purple-500" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Média Interjornada</p>
                                    <p className="text-2xl font-semibold">
                                        {analise.mediaInterjornada}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabela Detalhada */}
                    <div className="bg-card rounded-lg border overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-muted border-b">
                                    <tr>
                                        <th className="text-left p-4 text-sm font-medium">Data</th>
                                        <th className="text-left p-4 text-sm font-medium">Batidas</th>
                                        <th className="text-left p-4 text-sm font-medium">Diurnas</th>
                                        <th className="text-left p-4 text-sm font-medium">Noturnas</th>
                                        <th className="text-left p-4 text-sm font-medium">Total</th>
                                        <th className="text-left p-4 text-sm font-medium">Status</th>
                                        <th className="text-left p-4 text-sm font-medium">Interjornada</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {analise.dias.map((dia, index) => {
                                        const diurnas = converterHoraParaMinutos(dia.horasTrabalhadasDiurnas);
                                        const noturnas = converterHoraParaMinutos(dia.horasTrabalhadasNoturnas);
                                        const total = diurnas + noturnas;
                                        const status = getStatusExcesso(dia.horasTrabalhadasDiurnas, dia.horasTrabalhadasNoturnas);
                                        const StatusIcon = status.icone;

                                        return (
                                            <tr key={index} className="hover:bg-muted/50">
                                                <td className="p-4 text-sm">
                                                    {formatarData(dia.data)}
                                                </td>
                                                <td className="p-4 text-sm font-mono">
                                                    {formatarBatidas(dia.batidas)}
                                                </td>
                                                <td className="p-4 text-sm">
                                                    {dia.horasTrabalhadasDiurnas || '00:00'}
                                                </td>
                                                <td className="p-4 text-sm">
                                                    {dia.horasTrabalhadasNoturnas || '00:00'}
                                                </td>
                                                <td className="p-4 text-sm font-medium">
                                                    {formatarMinutosParaHora(total)}
                                                </td>
                                                <td className="p-4">
                                                    <div className={`flex items-center gap-1 ${status.cor}`}>
                                                        <StatusIcon className="h-4 w-4" />
                                                        <span className="text-sm">{status.texto}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-sm">
                                                    {dia.interjornada || '00:00'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : analise && analise.dias.length === 0 ? (
                <div className="bg-card rounded-lg border p-8 text-center">
                    <p className="text-muted-foreground">Nenhum dado encontrado para o período selecionado.</p>
                </div>
            ) : null}
        </div>
    );
}