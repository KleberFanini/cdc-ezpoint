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
    CheckCircle2,
    Briefcase,
    Gift,
    TrendingUp,
    TrendingDown,
    Coins // Novo ícone para banco de horas
} from 'lucide-react';
import { format, subMonths } from 'date-fns';

const ITENS_POR_PAGINA = 20;

interface EspelhoDia {
    data: string;
    horasTrabalhadasDiurnas: string;
    horasTrabalhadasNoturnas: string;
    batidas?: string | string[];
    interjornada: string;
    horario?: string;
    cargaHoraria?: string;
    horasAbonadas?: string;
    bancoDeHoras?: string;
}

interface AnaliseInterjornada {
    funcionario: Funcionario;
    dias: EspelhoDia[];
    totalHorasDiurnas: number;
    totalHorasNoturnas: number;
    totalCargaHoraria: number;
    totalHorasAbonadas: number;
    totalBancoDeHoras: number;
    totalExtraDiurna: number;
    totalExtraNoturna: number;
    totalAtraso: number;
    totalFalta: number;
    diasComExcesso: number;
    diasComJornadaNoturna: number;
    mediaInterjornada: string;
    totalFinaisSemana: number;
    totalFinaisSemanaTrabalhados: number;
}

export default function InterjornadaPage() {
    const { isAuthenticated, token, empresa } = useAuth();
    const router = useRouter();

    const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
    const [funcionariosFiltrados, setFuncionariosFiltrados] = useState<Funcionario[]>([]);
    const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<string>('');
    const [analise, setAnalise] = useState<AnaliseInterjornada | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingFuncionarios, setLoadingFuncionarios] = useState(true);
    const [error, setError] = useState('');
    const [departamentos, setDepartamentos] = useState<string[]>([]);
    const [cargos, setCargos] = useState<string[]>([]);
    const [filtroDepartamento, setFiltroDepartamento] = useState<string>('');
    const [filtroCargo, setFiltroCargo] = useState<string>('');

    // Filtros de data
    const [dataInicio, setDataInicio] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
    const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));

    // Função para obter informações da jornada baseada no departamento/cargo
    const getJornadaInfo = (funcionario: Funcionario): {
        base: number;
        temIntervalo: boolean;
        nomeJornada: string;
        intervaloMinutos: number;
    } => {
        const { departamento, cargo } = funcionario;

        // Verificar por cargo primeiro (tem prioridade)
        if (cargo) {
            const cargoUpper = cargo.toUpperCase();

            if (cargoUpper.includes('AUXILIAR ADM-APRENDIZ') || cargoUpper.includes('APRENDIZ')) {
                return {
                    base: 4,
                    temIntervalo: true,
                    intervaloMinutos: 15,
                    nomeJornada: 'Auxiliar Adm Aprendiz (4h c/ 15min intervalo)'
                };
            }

            if (cargoUpper.includes('ENFERMEIRA')) {
                return {
                    base: 4,
                    temIntervalo: true,
                    intervaloMinutos: 15,
                    nomeJornada: 'Enfermeira (4h c/ 15min intervalo)'
                };
            }
            if (cargoUpper.includes('ASSISTENTE SOCIAL')) {
                return {
                    base: 6,
                    temIntervalo: true,
                    intervaloMinutos: 15,
                    nomeJornada: 'Assistente Social (6h c/ 15min intervalo)'
                };
            }
            if (cargoUpper.includes('PLANTONISTA')) {
                return {
                    base: 11,
                    temIntervalo: false,
                    intervaloMinutos: 0,
                    nomeJornada: 'Plantonista (11h)'
                };
            }
        }

        // Verificar por departamento
        if (departamento) {
            const deptUpper = departamento.toUpperCase();
            if (['ATM', 'PPCAAM', 'CDC', 'FINANCEIRO', 'RH', 'ATITUDE', 'PPVIDA'].includes(deptUpper)) {
                return {
                    base: 8,
                    temIntervalo: false,
                    intervaloMinutos: 0,
                    nomeJornada: '8h'
                };
            }
        }

        // Padrão
        return {
            base: 8,
            temIntervalo: false,
            intervaloMinutos: 0,
            nomeJornada: '8h (padrão)'
        };
    };

    // Função para calcular a jornada esperada em minutos
    const getJornadaEsperadaMinutos = (funcionario: Funcionario): number => {
        const { base } = getJornadaInfo(funcionario);
        return base * 60;
    };

    // Função para verificar se o intervalo foi respeitado
    const verificarIntervalo = (batidas: string | string[] | undefined, funcionario: Funcionario): boolean => {
        const { temIntervalo, intervaloMinutos } = getJornadaInfo(funcionario);

        if (!temIntervalo || !batidas) return true;

        const listaBatidas = typeof batidas === 'string'
            ? batidas.split(' ').filter(b => b.trim())
            : batidas;

        if (listaBatidas.length < 3) return true;

        const segundaBatida = listaBatidas[1];
        const terceiraBatida = listaBatidas[2];

        if (!segundaBatida || !terceiraBatida) return true;

        const converterParaMinutos = (hora: string): number => {
            const [h, m] = hora.split(':').map(Number);
            return h * 60 + m;
        };

        const inicioIntervalo = converterParaMinutos(segundaBatida);
        const fimIntervalo = converterParaMinutos(terceiraBatida);
        const duracao = fimIntervalo - inicioIntervalo;

        return duracao >= intervaloMinutos;
    };

    // Função para verificar se há excesso (jornada + 2h)
    const verificarExcesso = (horasTrabalhadasMinutos: number, funcionario: Funcionario): boolean => {
        const jornadaEsperada = getJornadaEsperadaMinutos(funcionario);
        const limiteComExtra = jornadaEsperada + 120;
        return horasTrabalhadasMinutos > limiteComExtra;
    };

    // Função para obter o texto de status do excesso
    const getStatusExcesso = (diurnas: string, noturnas: string, batidas: string | string[] | undefined, funcionario: Funcionario, cargaHorariaDia?: string, horasAbonadas?: string) => {
        const totalTrabalhadoMinutos = converterHoraParaMinutos(diurnas) + converterHoraParaMinutos(noturnas);
        const abonadasMinutos = converterHoraParaMinutos(horasAbonadas || '00:00');
        const cargaDiaMinutos = converterHoraParaMinutos(cargaHorariaDia || '00:00');

        // Total considerado para cumprimento da jornada (trabalhado + abonadas)
        const totalConsideradoMinutos = totalTrabalhadoMinutos + abonadasMinutos;

        const horasTrabalhadasFormatadas = formatarMinutosParaHora(totalTrabalhadoMinutos);
        const abonadasFormatadas = formatarMinutosParaHora(abonadasMinutos);
        const cargaFormatada = formatarMinutosParaHora(cargaDiaMinutos);

        // Se não tem carga horária definida para o dia, não faz comparação
        if (cargaDiaMinutos === 0) {
            return {
                cor: 'text-muted-foreground',
                icone: Clock,
                texto: 'Sem carga definida'
            };
        }

        // Verifica se o total considerado (trabalhado + abonadas) é igual à carga horária
        if (totalConsideradoMinutos === cargaDiaMinutos) {
            // Se tiver horas abonadas, mostra que foi compensado com abono
            if (abonadasMinutos > 0) {
                return {
                    cor: 'text-green-600',
                    icone: CheckCircle2,
                    texto: `OK (${horasTrabalhadasFormatadas}h + ${abonadasFormatadas}h abono)`
                };
            }
            return {
                cor: 'text-green-600',
                icone: CheckCircle2,
                texto: `OK (${horasTrabalhadasFormatadas}h)`
            };
        }

        // Verifica se o total considerado é maior que a carga horária
        if (totalConsideradoMinutos > cargaDiaMinutos) {
            const extraMinutos = totalConsideradoMinutos - cargaDiaMinutos;
            const extraFormatado = formatarMinutosParaHora(extraMinutos);

            // Se tiver horas abonadas, mostra que o abono ajudou a compensar
            if (abonadasMinutos > 0) {
                if (extraMinutos > 120) {
                    return {
                        cor: 'text-destructive',
                        icone: AlertTriangle,
                        texto: `Excesso (+${extraFormatado}h c/ ${abonadasFormatadas}h abono)`
                    };
                }
                return {
                    cor: 'text-yellow-600',
                    icone: TrendingUp,
                    texto: `${cargaFormatada} + ${extraFormatado} extra (${abonadasFormatadas}h abono)`
                };
            }

            // Sem horas abonadas
            if (extraMinutos > 120) {
                return {
                    cor: 'text-destructive',
                    icone: AlertTriangle,
                    texto: `Excesso (+${extraFormatado}h)`
                };
            }

            return {
                cor: 'text-yellow-600',
                icone: TrendingUp,
                texto: `${cargaFormatada} + ${extraFormatado} extra`
            };
        }

        // Verifica se o total considerado é menor que a carga horária
        if (totalConsideradoMinutos < cargaDiaMinutos) {
            const faltaMinutos = cargaDiaMinutos - totalConsideradoMinutos;
            const faltaFormatado = formatarMinutosParaHora(faltaMinutos);

            // Se tiver horas abonadas mas ainda assim faltou
            if (abonadasMinutos > 0) {
                return {
                    cor: 'text-orange-500',
                    icone: TrendingDown,
                    texto: `-${faltaFormatado} falta (${abonadasFormatadas}h abono)`
                };
            }

            return {
                cor: 'text-orange-500',
                icone: TrendingDown,
                texto: `-${faltaFormatado} falta`
            };
        }

        // Fallback
        return {
            cor: 'text-green-600',
            icone: CheckCircle2,
            texto: `OK (${horasTrabalhadasFormatadas}h)`
        };
    };

    // Carregar lista de funcionários
    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        carregarFuncionarios();
    }, [isAuthenticated, router]);

    // Atualizar lista de funcionários filtrados quando os filtros mudarem
    useEffect(() => {
        if (funcionarios.length > 0) {
            let filtrados = [...funcionarios];

            if (filtroDepartamento) {
                filtrados = filtrados.filter(f => f.departamento === filtroDepartamento);
            }

            if (filtroCargo) {
                filtrados = filtrados.filter(f => f.cargo === filtroCargo);
            }

            setFuncionariosFiltrados(filtrados);

            if (funcionarioSelecionado && !filtrados.some(f => String(f.id) === String(funcionarioSelecionado))) {
                setFuncionarioSelecionado('');
            }
        }
    }, [funcionarios, filtroDepartamento, filtroCargo, funcionarioSelecionado]);

    // Extrair departamentos e cargos únicos dos funcionários
    useEffect(() => {
        if (funcionarios.length > 0) {
            const deps = new Set<string>();
            const cargosSet = new Set<string>();

            funcionarios.forEach(f => {
                if (f.departamento) deps.add(f.departamento);
                if (f.cargo) cargosSet.add(f.cargo);
            });

            setDepartamentos(Array.from(deps).sort((a, b) => a.localeCompare(b)));
            setCargos(Array.from(cargosSet).sort((a, b) => a.localeCompare(b)));
        }
    }, [funcionarios]);

    // Obter cargos do departamento selecionado
    const getCargosPorDepartamento = useCallback(() => {
        if (!filtroDepartamento) return cargos;

        const cargosDoDepartamento = new Set<string>();
        funcionarios
            .filter(f => f.departamento === filtroDepartamento)
            .forEach(f => {
                if (f.cargo) cargosDoDepartamento.add(f.cargo);
            });

        return Array.from(cargosDoDepartamento).sort((a, b) => a.localeCompare(b));
    }, [funcionarios, filtroDepartamento, cargos]);

    const carregarFuncionarios = async () => {
        if (!token || !empresa) return;

        setLoadingFuncionarios(true);
        try {
            const url = `/api/funcionarios?token=${encodeURIComponent(token)}&empresa=${encodeURIComponent(empresa)}&ocultarDemitidos=true`;
            const response = await fetch(url);
            const data = await response.json();
            const listaFuncionarios = data.listaDeFuncionarios || [];
            setFuncionarios(listaFuncionarios);
            setFuncionariosFiltrados(listaFuncionarios);
        } catch (err) {
            console.error('Erro ao carregar funcionários:', err);
            setError('Erro ao carregar lista de funcionários');
        } finally {
            setLoadingFuncionarios(false);
        }
    };

    const verificarExcessoNoDia = (diurnas: string, noturnas: string, cargaHorariaDia?: string, horasAbonadas?: string): boolean => {
        const totalTrabalhadoMinutos = converterHoraParaMinutos(diurnas) + converterHoraParaMinutos(noturnas);
        const abonadasMinutos = converterHoraParaMinutos(horasAbonadas || '00:00');
        const cargaDiaMinutos = converterHoraParaMinutos(cargaHorariaDia || '00:00');

        // Se não tem carga definida, não considera excesso
        if (cargaDiaMinutos === 0) return false;

        // Total considerado (trabalhado + abonadas)
        const totalConsideradoMinutos = totalTrabalhadoMinutos + abonadasMinutos;

        // Verifica se o total considerado excede a carga em mais de 2h (120 minutos)
        return totalConsideradoMinutos > cargaDiaMinutos + 120;
    };

    const analisarInterjornada = useCallback(async () => {
        if (!token || !empresa || !funcionarioSelecionado) return;

        setLoading(true);
        setError('');
        setAnalise(null);

        try {
            const funcionario = funcionariosFiltrados.find(f => String(f.id) === String(funcionarioSelecionado));
            if (!funcionario) {
                throw new Error(`Funcionário com ID ${funcionarioSelecionado} não encontrado`);
            }

            const url = `/api/espelho-ponto?token=${encodeURIComponent(token)}&empresa=${encodeURIComponent(empresa)}&idFuncionario=${funcionarioSelecionado}&dataInicio=${dataInicio}&dataFim=${dataFim}`;

            const response = await fetch(url);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Erro HTTP: ${response.status}`);
            }

            const dias = data.dias || [];
            const totalColunas = data.totalColunas || {};

            // 🔥 TODOS OS TOTAIS VEM DO totalColunas DA API
            const totalBancoDeHoras = converterHoraParaMinutos(totalColunas.bancoDeHoras || '00:00');
            const totalCargaHoraria = converterHoraParaMinutos(totalColunas.cargaHoraria || '00:00');
            const totalHorasDiurnas = converterHoraParaMinutos(totalColunas.horasTrabalhadasDiurnas || '00:00');
            const totalHorasNoturnas = converterHoraParaMinutos(totalColunas.horasTrabalhadasNoturnas || '00:00');
            const totalHorasAbonadas = converterHoraParaMinutos(totalColunas.horasAbonadas || '00:00');
            const totalExtraDiurna = converterHoraParaMinutos(totalColunas.extraDiurna || '00:00');
            const totalExtraNoturna = converterHoraParaMinutos(totalColunas.extraNoturna || '00:00');
            const totalAtraso = converterHoraParaMinutos(totalColunas.atraso || '00:00');
            const totalFalta = converterHoraParaMinutos(totalColunas.falta || '00:00');

            // Contagem de dias com excesso
            let diasExcesso = 0;
            let diasNoturnos = 0;
            let somaInterjornada = 0;
            let diasComInterjornada = 0;
            let totalFinaisSemana = 0;
            let totalFinaisSemanaTrabalhados = 0;

            dias.forEach((dia: EspelhoDia) => {
                const diurnas = converterHoraParaMinutos(dia.horasTrabalhadasDiurnas || '00:00');
                const noturnas = converterHoraParaMinutos(dia.horasTrabalhadasNoturnas || '00:00');
                const ehWeekend = isWeekend(dia.data);

                // Verifica excesso no dia
                if (verificarExcessoNoDia(
                    dia.horasTrabalhadasDiurnas,
                    dia.horasTrabalhadasNoturnas,
                    dia.cargaHoraria,
                    dia.horasAbonadas
                )) {
                    diasExcesso++;
                }

                // Contagem de finais de semana
                if (ehWeekend) {
                    totalFinaisSemana++;
                    if (diurnas > 0 || noturnas > 0) {
                        totalFinaisSemanaTrabalhados++;
                    }
                }

                // Verifica intervalo inválido
                if (getJornadaInfo(funcionario).temIntervalo && !verificarIntervalo(dia.batidas, funcionario)) {
                    if (!verificarExcessoNoDia(
                        dia.horasTrabalhadasDiurnas,
                        dia.horasTrabalhadasNoturnas,
                        dia.cargaHoraria,
                        dia.horasAbonadas
                    )) {
                        diasExcesso++;
                    }
                }

                // Contagem de dias com trabalho noturno
                if (noturnas > 0) {
                    diasNoturnos++;
                }

                // Média de interjornada
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
                totalHorasDiurnas,      // 🔥 DA API
                totalHorasNoturnas,     // 🔥 DA API
                totalCargaHoraria,      // 🔥 DA API
                totalHorasAbonadas,     // 🔥 DA API
                totalBancoDeHoras,      // 🔥 DA API
                totalExtraDiurna,       // 🔥 DA API
                totalExtraNoturna,      // 🔥 DA API
                totalAtraso,            // 🔥 DA API
                totalFalta,             // 🔥 DA API
                diasComExcesso: diasExcesso,
                diasComJornadaNoturna: diasNoturnos,
                mediaInterjornada,
                totalFinaisSemana,
                totalFinaisSemanaTrabalhados
            });

        } catch (err: any) {
            console.error('Erro na análise:', err);
            setError(err.message || 'Erro ao analisar dados');
        } finally {
            setLoading(false);
        }
    }, [token, empresa, funcionarioSelecionado, dataInicio, dataFim, funcionariosFiltrados]);

    const converterHoraParaMinutos = (hora: string): number => {
        if (!hora || hora === '00:00') return 0;
        const [h, m] = hora.split(':').map(Number);
        return h * 60 + m;
    };

    const formatarMinutosParaHora = (minutos: number): string => {
        const horas = Math.floor(Math.abs(minutos) / 60);
        const mins = Math.round(Math.abs(minutos) % 60);
        const sinal = minutos < 0 ? '-' : '';
        return `${sinal}${horas.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    const formatarData = (dataStr: string) => {
        try {
            const [dia, mes, ano] = dataStr.split('/');
            return `${dia}/${mes}/${ano}`;
        } catch {
            return dataStr;
        }
    };

    const getDiaSemana = (dataStr: string): string => {
        try {
            const [dia, mes, ano] = dataStr.split('/').map(Number);
            const data = new Date(ano, mes - 1, dia);
            const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
            return diasSemana[data.getDay()];
        } catch {
            return '';
        }
    };

    const isWeekend = (dataStr: string): boolean => {
        try {
            const [dia, mes, ano] = dataStr.split('/').map(Number);
            const data = new Date(ano, mes - 1, dia);
            const diaSemana = data.getDay();

            return diaSemana === 0 || diaSemana === 6;
        } catch {
            return false;
        }
    };

    const formatarBatidas = (dia: EspelhoDia): { texto: string; cor: string; isWeekend: boolean } => {
        if (dia.horario === 'FOLGA') {
            return { texto: 'FOLGA', cor: 'text-green-600 font-medium', isWeekend: isWeekend(dia.data) };
        }

        const ehWeekend = isWeekend(dia.data);

        if (!dia.batidas) {
            if (ehWeekend) {
                return { texto: 'FINAL DE SEMANA', cor: 'text-purple-600 font-medium', isWeekend: true };
            }
            return { texto: '-', cor: 'text-muted-foreground', isWeekend: false };
        }

        let batidasTexto = '';
        if (Array.isArray(dia.batidas)) {
            batidasTexto = dia.batidas.join(' - ');
        } else {
            batidasTexto = dia.batidas.split(' ').join(' - ');
        }

        return {
            texto: batidasTexto,
            cor: 'text-foreground',
            isWeekend: ehWeekend
        };
    };

    const formatarBancoHoras = (banco: string | number): { valor: string; cor: string } => {
        // Se for número, converte para string no formato HH:MM
        if (typeof banco === 'number') {
            if (banco === 0) return { valor: '00:00', cor: 'text-muted-foreground' };

            const isNegative = banco < 0;
            const absMinutos = Math.abs(banco);
            const horas = Math.floor(absMinutos / 60);
            const minutos = absMinutos % 60;
            const valorStr = `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}`;

            return {
                valor: isNegative ? `-${valorStr}` : valorStr,
                cor: isNegative ? 'text-destructive' : 'text-green-600'
            };
        }

        // Se for string, mantém o valor original
        if (!banco || banco === '00:00') {
            return { valor: '00:00', cor: 'text-muted-foreground' };
        }

        const isNegative = banco.startsWith('-');
        const valorAbs = isNegative ? banco.substring(1) : banco;

        return {
            valor: isNegative ? `-${valorAbs}` : valorAbs,
            cor: isNegative ? 'text-destructive' : 'text-green-600'
        };
    };

    if (!isAuthenticated) {
        return null;
    }

    const cargosFiltrados = getCargosPorDepartamento();
    const bancoInfo = analise ? formatarBancoHoras(analise.totalBancoDeHoras) : null;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-foreground">Análise de Interjornada</h1>
            </div>

            {/* Filtros */}
            <div className="bg-card rounded-lg border border-border p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Filtro de Funcionário */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-foreground mb-1">
                            Funcionário
                        </label>
                        <select
                            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2"
                            value={funcionarioSelecionado}
                            onChange={(e) => setFuncionarioSelecionado(e.target.value)}
                            disabled={loadingFuncionarios || funcionariosFiltrados.length === 0}
                        >
                            <option value="">Selecione um funcionário</option>
                            {funcionariosFiltrados.map((f) => (
                                <option key={f.id} value={f.id}>
                                    {f.matricula} - {f.nome} {f.cargo ? `(${f.cargo})` : ''}
                                </option>
                            ))}
                        </select>
                        {funcionariosFiltrados.length === 0 && !loadingFuncionarios && (
                            <p className="text-xs text-destructive mt-1">
                                Nenhum funcionário encontrado com os filtros selecionados
                            </p>
                        )}
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

                    {/* Filtro de Departamento */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                            Departamento
                        </label>
                        <select
                            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2"
                            value={filtroDepartamento}
                            onChange={(e) => {
                                setFiltroDepartamento(e.target.value);
                                setFiltroCargo('');
                            }}
                            disabled={loadingFuncionarios}
                        >
                            <option value="">Todos os departamentos</option>
                            {departamentos.map((depto) => (
                                <option key={depto} value={depto}>
                                    {depto}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro de Cargo */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                            Cargo
                        </label>
                        <select
                            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            value={filtroCargo}
                            onChange={(e) => setFiltroCargo(e.target.value)}
                            disabled={loadingFuncionarios || !filtroDepartamento}
                        >
                            <option value="">{filtroDepartamento ? 'Todos os cargos' : 'Selecione um departamento primeiro'}</option>
                            {cargosFiltrados.map((cargo) => (
                                <option key={cargo} value={cargo}>
                                    {cargo}
                                </option>
                            ))}
                        </select>
                        {!filtroDepartamento && (
                            <p className="text-xs text-muted-foreground mt-1">
                                Selecione um departamento para filtrar cargos
                            </p>
                        )}
                    </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={() => {
                            setFiltroDepartamento('');
                            setFiltroCargo('');
                            setFuncionarioSelecionado('');
                        }}
                    >
                        Limpar Filtros
                    </Button>

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
                    {/* Primeira Linha de Cards (4 cards) */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-card rounded-lg border p-6">
                            <div className="flex items-center gap-3">
                                <Briefcase className="h-5 w-5 text-purple-500" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Carga Horária</p>
                                    <p className="text-2xl font-semibold">
                                        {formatarMinutosParaHora(analise.totalCargaHoraria)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-card rounded-lg border p-6">
                            <div className="flex items-center gap-3">
                                <Sun className="h-5 w-5 text-yellow-500" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Horas Diurnas</p>
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
                                    <p className="text-sm text-muted-foreground">Horas Noturnas</p>
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
                                    <p className="text-sm text-muted-foreground">Dias c/ Excesso</p>
                                    <p className="text-2xl font-semibold text-destructive">
                                        {analise.diasComExcesso}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Segunda Linha de Cards (3 cards) - REMOVIDOS EXTRA DIURNA/NOTURNA */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                        {/* NOVO CARD: Banco de Horas Total */}
                        <div className="bg-card rounded-lg border p-6">
                            <div className="flex items-center gap-3">
                                <Coins className={`h-5 w-5 ${bancoInfo?.cor}`} />
                                <div>
                                    <p className="text-sm text-muted-foreground">Banco de Horas</p>
                                    <p className={`text-2xl font-semibold ${bancoInfo?.cor}`}>
                                        {bancoInfo?.valor}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-card rounded-lg border p-6">
                            <div className="flex items-center gap-3">
                                <Gift className="h-5 w-5 text-orange-500" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Horas Abonadas</p>
                                    <p className="text-2xl font-semibold text-orange-600">
                                        {formatarMinutosParaHora(analise.totalHorasAbonadas)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabela Detalhada - REMOVIDAS EXTRA DIURNA/NOTURNA */}
                    <div className="bg-card rounded-lg border overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-muted border-b">
                                    <tr>
                                        <th className="text-left p-4 text-sm font-medium">Data</th>
                                        <th className="text-left p-4 text-sm font-medium">Batidas</th>
                                        <th className="text-left p-4 text-sm font-medium">Diurnas</th>
                                        <th className="text-left p-4 text-sm font-medium">Noturnas</th>
                                        <th className="text-left p-4 text-sm font-medium">Abonadas</th>
                                        <th className="text-left p-4 text-sm font-medium">Banco de Horas</th>
                                        <th className="text-left p-4 text-sm font-medium">Carga Horária</th>
                                        <th className="text-left p-4 text-sm font-medium">Status</th>
                                        <th className="text-left p-4 text-sm font-medium">Interjornada</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {analise.dias.map((dia, index) => {
                                        const diurnas = converterHoraParaMinutos(dia.horasTrabalhadasDiurnas);
                                        const noturnas = converterHoraParaMinutos(dia.horasTrabalhadasNoturnas);
                                        const bancoMinutos = converterHoraParaMinutos(dia.bancoDeHoras || '00:00');
                                        const bancoFormatado = formatarBancoHoras(dia.bancoDeHoras || '00:00');
                                        const batidasFormatado = formatarBatidas(dia);
                                        const diaSemana = getDiaSemana(dia.data);
                                        const ehWeekend = diaSemana === 'Sábado' || diaSemana === 'Domingo';

                                        const status = getStatusExcesso(
                                            dia.horasTrabalhadasDiurnas,
                                            dia.horasTrabalhadasNoturnas,
                                            dia.batidas,
                                            analise.funcionario,
                                            dia.cargaHoraria,
                                            dia.horasAbonadas
                                        );
                                        const StatusIcon = status.icone;

                                        return (
                                            <tr key={index} className={`hover:bg-muted/50 ${batidasFormatado.isWeekend ? 'bg-purple-50/30' : ''}`}>
                                                <td className="p-4 text-sm">
                                                    <div>
                                                        <span className={ehWeekend ? 'font-semibold' : ''}>
                                                            {formatarData(dia.data)}
                                                        </span>
                                                        <span className={`text-xs block ${ehWeekend ? 'text-purple-600' : 'text-muted-foreground'}`}>
                                                            {diaSemana}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-sm font-mono max-w-xs truncate">
                                                    <span className={batidasFormatado.cor}>
                                                        {batidasFormatado.texto}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm">
                                                    {dia.horasTrabalhadasDiurnas || '00:00'}
                                                </td>
                                                <td className="p-4 text-sm">
                                                    {dia.horasTrabalhadasNoturnas || '00:00'}
                                                </td>
                                                <td className="p-4 text-sm text-orange-600">
                                                    {dia.horasAbonadas || '00:00'}
                                                </td>
                                                <td className="p-4 text-sm">
                                                    <span className={`font-mono font-medium ${bancoFormatado.cor}`}>
                                                        {bancoFormatado.valor}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm font-mono">
                                                    {dia.cargaHoraria || '00:00'}
                                                </td>
                                                <td className="p-4">
                                                    <div className={`flex items-center gap-1 ${status.cor}`}>
                                                        <StatusIcon className="h-4 w-4" />
                                                        <span className="text-sm whitespace-nowrap">{status.texto}</span>
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