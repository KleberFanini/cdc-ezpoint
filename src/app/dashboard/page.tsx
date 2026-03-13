'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Funcionario, Batida } from '@/services/ezpointApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    LogOut,
    Search,
    Loader2,
    UserCircle,
    Clock,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    RefreshCw,
    Building2,
    Calendar
} from 'lucide-react';
import { format, subMonths } from 'date-fns';

const ITENS_POR_PAGINA = 20;

export default function DashboardPage() {
    const { isAuthenticated, token, empresa, logout } = useAuth();
    const router = useRouter();

    const [todosFuncionarios, setTodosFuncionarios] = useState<Funcionario[]>([]);
    const [funcionariosFiltrados, setFuncionariosFiltrados] = useState<Funcionario[]>([]);
    const [funcionariosPagina, setFuncionariosPagina] = useState<Funcionario[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingPagina, setLoadingPagina] = useState(false);
    const [error, setError] = useState('');
    const [usandoCache, setUsandoCache] = useState(false);
    const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);

    // Paginação
    const [paginaAtual, setPaginaAtual] = useState(1);
    const [totalPaginas, setTotalPaginas] = useState(1);

    // Dados adicionais por funcionário da PÁGINA ATUAL apenas
    const [saldos, setSaldos] = useState<Record<string, string>>({});
    const [ultimasBatidas, setUltimasBatidas] = useState<Record<string, Batida>>({});
    const [loadingDados, setLoadingDados] = useState<Record<string, boolean>>({});

    // Filtros
    const [filtroNome, setFiltroNome] = useState('');
    const [filtroDepartamento, setFiltroDepartamento] = useState('');
    const [filtroSaldo, setFiltroSaldo] = useState('todos'); // 'todos', 'positivo', 'negativo'

    // Filtros de data
    const [dataInicio, setDataInicio] = useState(format(subMonths(new Date(), 2), 'yyyy-MM-dd'));
    const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));

    // Lista única de departamentos para o select
    const [departamentos, setDepartamentos] = useState<string[]>([]);

    // Cache de batidas (carregado uma única vez para todas as páginas)
    const [todasBatidas, setTodasBatidas] = useState<Batida[]>([]);
    const [batidasCarregadas, setBatidasCarregadas] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }

        carregarFuncionarios();
    }, [isAuthenticated, router]);

    // Carregar batidas APÓS carregar funcionários (uma única vez)
    useEffect(() => {
        if (token && empresa && !loading && todosFuncionarios.length > 0 && !batidasCarregadas) {
            carregarTodasBatidas();
        }
    }, [token, empresa, loading, todosFuncionarios, batidasCarregadas]);

    // Recarregar batidas quando as datas mudarem
    useEffect(() => {
        if (token && empresa && !loading && batidasCarregadas) {
            setBatidasCarregadas(false);
            setTodasBatidas([]);
            carregarTodasBatidas();
        }
    }, [dataInicio, dataFim]);

    // Aplicar filtros e paginar quando os dados mudarem
    useEffect(() => {
        if (todosFuncionarios.length > 0) {
            aplicarFiltrosEPaginar();
        }
    }, [paginaAtual, filtroNome, filtroDepartamento, filtroSaldo, todosFuncionarios, saldos]);

    // Extrair departamentos únicos quando os funcionários são carregados
    useEffect(() => {
        if (todosFuncionarios.length > 0) {
            const deps = new Set<string>();
            todosFuncionarios.forEach(func => {
                if (func.departamento) {
                    deps.add(func.departamento);
                }
            });
            const sortedDeps = Array.from(deps).sort((a, b) => a.localeCompare(b));
            setDepartamentos(sortedDeps);
        }
    }, [todosFuncionarios]);

    // Carregar saldos dos funcionários da página atual
    useEffect(() => {
        if (funcionariosPagina.length > 0) {
            funcionariosPagina.forEach(func => {
                if (!saldos[func.id] && !loadingDados[func.id]) {
                    carregarDadosFuncionario(func);
                }
            });
        }
    }, [funcionariosPagina]);

    const carregarFuncionarios = async (forceRefresh = false) => {
        if (!token || !empresa) return;

        setLoading(true);
        setError('');
        setUsandoCache(false);

        const startTime = Date.now();

        try {
            const url = `/api/funcionarios?token=${encodeURIComponent(token)}&empresa=${encodeURIComponent(empresa)}&ocultarDemitidos=true${forceRefresh ? '&forceRefresh=true' : ''}`;

            const response = await fetch(url);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Erro HTTP: ${response.status}`);
            }

            if (data._fallback) {
                setUsandoCache(true);
            }

            setTodosFuncionarios(data.listaDeFuncionarios || []);
            setUltimaAtualizacao(new Date());

            const elapsedTime = Date.now() - startTime;
            if (elapsedTime < 500) {
                await new Promise(resolve => setTimeout(resolve, 500 - elapsedTime));
            }

        } catch (err: any) {
            console.error('Erro:', err);

            if (err.message?.includes('502') || err.message?.includes('503')) {
                setError('O servidor do EZPoint está instável. Tentando usar dados em cache...');
                setTimeout(() => carregarFuncionarios(false), 2000);
            } else {
                setError(err.message || 'Erro ao carregar funcionários');
            }

            if (err.message?.includes('401')) {
                logout();
            }
        } finally {
            setLoading(false);
        }
    };

    const carregarDadosFuncionario = async (funcionario: Funcionario) => {
        if (!token || !empresa) return;

        setLoadingDados(prev => ({ ...prev, [funcionario.id]: true }));

        try {
            // Carregar saldo com as datas selecionadas
            const espelhoUrl = `/api/espelho-ponto?token=${encodeURIComponent(token)}&empresa=${encodeURIComponent(empresa)}&idFuncionario=${funcionario.id}&dataInicio=${dataInicio}&dataFim=${dataFim}`;
            const espelhoResponse = await fetch(espelhoUrl);

            if (espelhoResponse.ok) {
                const espelhoData = await espelhoResponse.json();
                setSaldos(prev => ({
                    ...prev,
                    [funcionario.id]: espelhoData.totalColunas?.bancoDeHoras || '00:00'
                }));
            }

        } catch (err) {
            console.error(`Erro ao carregar dados do funcionário ${funcionario.id}:`, err);
        } finally {
            setLoadingDados(prev => ({ ...prev, [funcionario.id]: false }));
        }
    };

    const carregarTodasBatidas = async () => {
        if (!token || !empresa) return;

        try {
            console.log('Carregando todas as batidas...');
            let todas: Batida[] = [];
            let pagina = 1;
            let totalPaginasAPI = 1;

            const primeiraUrl = `/api/batidas?token=${encodeURIComponent(token)}&empresa=${encodeURIComponent(empresa)}&dataInicio=${dataInicio}&dataFim=${dataFim}&pagina=1`;
            const primeiraResponse = await fetch(primeiraUrl);

            if (primeiraResponse.ok) {
                const primeiraData = await primeiraResponse.json();
                todas = [...primeiraData.listaDeBatidas];
                totalPaginasAPI = primeiraData.totalPaginas || 1;

                if (totalPaginasAPI > 1) {
                    const promises = [];
                    for (pagina = 2; pagina <= totalPaginasAPI; pagina++) {
                        const url = `/api/batidas?token=${encodeURIComponent(token)}&empresa=${encodeURIComponent(empresa)}&dataInicio=${dataInicio}&dataFim=${dataFim}&pagina=${pagina}`;
                        promises.push(fetch(url).then(res => res.json()));
                    }

                    const resultados = await Promise.all(promises);
                    resultados.forEach(data => {
                        todas = [...todas, ...data.listaDeBatidas];
                    });
                }

                console.log(`Total de batidas carregadas: ${todas.length}`);
                setTodasBatidas(todas);
                setBatidasCarregadas(true);

                // Processar últimas batidas para TODOS os funcionários
                const batidasPorMatricula: Record<string, Batida> = {};
                todas.forEach((batida: Batida) => {
                    const matricula = batida.matriculaFuncionario;
                    if (!batidasPorMatricula[matricula] ||
                        new Date(`${batida.data}T${batida.hora}`) > new Date(`${batidasPorMatricula[matricula].data}T${batidasPorMatricula[matricula].hora}`)) {
                        batidasPorMatricula[matricula] = batida;
                    }
                });
                setUltimasBatidas(batidasPorMatricula);
            }

        } catch (err) {
            console.error('Erro ao carregar todas as batidas:', err);
        }
    };

    const aplicarFiltrosEPaginar = useCallback(() => {
        setLoadingPagina(true);

        // Aplicar filtros
        let filtrados = [...todosFuncionarios];

        if (filtroNome) {
            filtrados = filtrados.filter(func =>
                func.nome.toLowerCase().includes(filtroNome.toLowerCase())
            );
        }

        if (filtroDepartamento) {
            filtrados = filtrados.filter(func =>
                func.departamento === filtroDepartamento
            );
        }

        // Filtrar por saldo (usando os saldos já carregados da página)
        if (filtroSaldo !== 'todos') {
            filtrados = filtrados.filter(func => {
                const saldo = saldos[func.id];
                if (!saldo) return true; // Se não tem saldo ainda, mantém (vai aparecer com placeholder)

                const isNegative = saldo.startsWith('-');
                return filtroSaldo === 'positivo' ? !isNegative : isNegative;
            });
        }

        setFuncionariosFiltrados(filtrados);

        // Calcular total de páginas
        const total = filtrados.length;
        const paginas = Math.ceil(total / ITENS_POR_PAGINA);
        setTotalPaginas(paginas || 1);

        // Ajustar página atual se necessário
        if (paginaAtual > paginas && paginas > 0) {
            setPaginaAtual(paginas);
        }

        // Pegar apenas os funcionários da página atual
        const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
        const fim = inicio + ITENS_POR_PAGINA;
        const funcionariosDaPagina = filtrados.slice(inicio, fim);

        setFuncionariosPagina(funcionariosDaPagina);
        setLoadingPagina(false);

    }, [todosFuncionarios, filtroNome, filtroDepartamento, filtroSaldo, saldos, paginaAtual]);

    const handleLimparFiltros = () => {
        setFiltroNome('');
        setFiltroDepartamento('');
        setFiltroSaldo('todos');
        setDataInicio(format(subMonths(new Date(), 2), 'yyyy-MM-dd'));
        setDataFim(format(new Date(), 'yyyy-MM-dd'));
        setPaginaAtual(1);
    };

    const handleRefresh = () => {
        setBatidasCarregadas(false);
        setTodasBatidas([]);
        setSaldos({});
        setUltimasBatidas({});
        carregarFuncionarios(true);
    };

    const handlePaginaAnterior = () => {
        setPaginaAtual(prev => Math.max(1, prev - 1));
    };

    const handleProximaPagina = () => {
        setPaginaAtual(prev => Math.min(totalPaginas, prev + 1));
    };

    const handlePrimeiraPagina = () => {
        setPaginaAtual(1);
    };

    const handleUltimaPagina = () => {
        setPaginaAtual(totalPaginas);
    };

    const formatarSaldo = (saldo: string) => {
        if (!saldo) return { valor: '00:00', isNegative: false };
        const isNegative = saldo.startsWith('-');
        return { valor: saldo, isNegative };
    };

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Topbar */}
            <div className="bg-card border-b border-border sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground text-sm">
                                CDC
                            </div>
                            <h1 className="text-xl font-semibold text-foreground">
                                Painel de Funcionários
                            </h1>
                            <span className="text-sm text-muted-foreground">
                                {empresa}
                            </span>
                        </div>

                        <Button variant="outline" onClick={logout} size="sm">
                            <LogOut className="h-4 w-4 mr-2" />
                            Sair
                        </Button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Filtros de Data */}
                <div className="bg-card rounded-lg border border-border p-6 card-shadow mb-8">
                    <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Período de Análise
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
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
                </div>

                {/* Filtros de Funcionários */}
                <div className="bg-card rounded-lg border border-border p-6 card-shadow mb-8">
                    <h2 className="text-lg font-semibold text-foreground mb-4">Filtrar Funcionários</h2>

                    <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Nome
                                </label>
                                <Input
                                    type="text"
                                    placeholder="Buscar por nome..."
                                    value={filtroNome}
                                    onChange={(e) => setFiltroNome(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Departamento
                                </label>
                                <select
                                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    value={filtroDepartamento}
                                    onChange={(e) => setFiltroDepartamento(e.target.value)}
                                >
                                    <option value="">Todos os departamentos</option>
                                    {departamentos.map((depto) => (
                                        <option key={depto} value={depto}>
                                            {depto}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Filtro de Saldo */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                                Saldo de Horas
                            </label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        name="saldo"
                                        value="todos"
                                        checked={filtroSaldo === 'todos'}
                                        onChange={(e) => setFiltroSaldo(e.target.value)}
                                        className="h-4 w-4 text-primary border-border focus:ring-primary"
                                    />
                                    <span className="text-sm text-foreground">Todos</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        name="saldo"
                                        value="positivo"
                                        checked={filtroSaldo === 'positivo'}
                                        onChange={(e) => setFiltroSaldo(e.target.value)}
                                        className="h-4 w-4 text-primary border-border focus:ring-primary"
                                    />
                                    <span className="text-sm text-green-600 font-medium">Positivo</span>
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        name="saldo"
                                        value="negativo"
                                        checked={filtroSaldo === 'negativo'}
                                        onChange={(e) => setFiltroSaldo(e.target.value)}
                                        className="h-4 w-4 text-primary border-border focus:ring-primary"
                                    />
                                    <span className="text-sm text-destructive font-medium">Negativo</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end">
                            <Button type="button" variant="outline" onClick={handleLimparFiltros}>
                                Limpar
                            </Button>
                        </div>
                    </form>
                </div>

                {usandoCache && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-yellow-800">
                                <AlertCircle className="h-4 w-4" />
                                <span className="text-sm">
                                    Usando dados em cache. A API do EZPoint está temporariamente indisponível.
                                    {ultimaAtualizacao && (
                                        <span className="block text-xs mt-1">
                                            Última atualização: {ultimaAtualizacao.toLocaleString('pt-BR')}
                                        </span>
                                    )}
                                </span>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRefresh}
                                disabled={loading}
                            >
                                {loading ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-2" />
                                ) : (
                                    <RefreshCw className="h-3 w-3 mr-2" />
                                )}
                                Tentar novamente
                            </Button>
                        </div>
                    </div>
                )}

                <div className="bg-card rounded-lg border border-border card-shadow overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : error ? (
                        <div className="text-center py-20">
                            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                            <p className="text-destructive mb-4">{error}</p>
                            <div className="space-x-2">
                                <Button
                                    variant="outline"
                                    onClick={() => carregarFuncionarios(true)}
                                >
                                    Tentar novamente
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => router.push('/login')}
                                >
                                    Voltar ao login
                                </Button>
                            </div>
                        </div>
                    ) : loadingPagina ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : funcionariosPagina.length === 0 ? (
                        <div className="text-center py-20">
                            <UserCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">Nenhum funcionário encontrado</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-muted border-b border-border">
                                        <tr>
                                            <th className="text-left p-4 text-sm font-medium text-muted-foreground">Matrícula</th>
                                            <th className="text-left p-4 text-sm font-medium text-muted-foreground">Nome</th>
                                            <th className="text-left p-4 text-sm font-medium text-muted-foreground">Departamento</th>
                                            <th className="text-left p-4 text-sm font-medium text-muted-foreground">Saldo de Horas</th>
                                            <th className="text-left p-4 text-sm font-medium text-muted-foreground">Última Batida</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {funcionariosPagina.map((func) => {
                                            const saldoInfo = saldos[func.id] ? formatarSaldo(saldos[func.id]) : { valor: '00:00', isNegative: false };
                                            const ultimaBatida = ultimasBatidas[func.matricula];
                                            const carregando = loadingDados[func.id];

                                            return (
                                                <tr key={func.id} className="hover:bg-muted/50 transition-colors">
                                                    <td className="p-4 text-sm text-foreground font-mono">
                                                        {func.matricula || '-'}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="font-medium text-foreground">{func.nome}</div>
                                                        {func.cargo && (
                                                            <div className="text-xs text-muted-foreground">{func.cargo}</div>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2">
                                                            <Building2 className="h-4 w-4 text-muted-foreground" />
                                                            <span className="text-sm text-foreground">
                                                                {func.departamento || '-'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        {carregando ? (
                                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                                        ) : (
                                                            <span className={`text-sm font-mono font-medium ${saldoInfo.isNegative ? 'text-destructive' : 'text-green-600'
                                                                }`}>
                                                                {saldoInfo.valor}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        {ultimaBatida ? (
                                                            <div className="flex items-center gap-2">
                                                                <Clock className="h-4 w-4 text-muted-foreground" />
                                                                <span className="text-sm text-foreground">
                                                                    {new Date(ultimaBatida.data).toLocaleDateString('pt-BR')} {ultimaBatida.hora.substring(0, 5)}
                                                                </span>
                                                                {ultimaBatida.ocorrencia === 'D' && (
                                                                    <span className="text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
                                                                        D
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-sm text-muted-foreground">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {funcionariosFiltrados.length > 0 && (
                                <div className="flex items-center justify-between px-4 py-4 border-t border-border">
                                    <div className="text-sm text-muted-foreground">
                                        Mostrando <span className="font-medium">{funcionariosPagina.length}</span> de{' '}
                                        <span className="font-medium">{funcionariosFiltrados.length}</span> funcionários
                                        {filtroNome || filtroDepartamento || filtroSaldo !== 'todos' ? ' (filtrados)' : ''}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handlePrimeiraPagina}
                                            disabled={paginaAtual === 1}
                                        >
                                            <ChevronsLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handlePaginaAnterior}
                                            disabled={paginaAtual === 1}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <span className="flex items-center px-3 py-2 text-sm text-foreground">
                                            Página {paginaAtual} de {totalPaginas}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleProximaPagina}
                                            disabled={paginaAtual === totalPaginas}
                                        >
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleUltimaPagina}
                                            disabled={paginaAtual === totalPaginas}
                                        >
                                            <ChevronsRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}