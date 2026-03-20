export interface Funcionario {
    id: string;
    matricula: string;
    nome: string;
    pis: string;
    cargo: string;
    cnpjCpfEmpresa: string;
    setor: string;
    cidade: string;
    dataAdmissao: string;
    idParametro: number;
    senha: string;
    pin: string;
    cidadeLocalDeTrabalho: string;
    cpf: string;
    departamento: string;
    ctps: string;
    sexo: string;
    idHorario?: number;
}

export interface FuncionariosResponse {
    listaDeFuncionarios: Funcionario[];
}

export interface EspelhoPonto {
    totalColunas: {
        bancoDeHoras: string;
    };
}

export interface Batida {
    id: number;
    data: string;
    hora: string;
    nomeFuncionario: string;
    cpfFuncionario: string;
    pisFuncionario: string;
    matriculaFuncionario: string;
    ocorrencia: string;
}

export interface BatidasResponse {
    listaDeBatidas: Batida[];
    totalPaginas: number;
}

export const ezpointApi = {
    // Buscar funcionários via proxy
    getFuncionarios: async (
        token: string,
        empresa: string,
        ocultarDemitidos: boolean = true
    ) => {
        try {
            const url = `/api/funcionarios?token=${encodeURIComponent(token)}&empresa=${encodeURIComponent(empresa)}&ocultarDemitidos=${ocultarDemitidos}`;

            const response = await fetch(url);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `Erro HTTP: ${response.status}`);
            }

            const data = await response.json();
            return data as FuncionariosResponse;
        } catch (error) {
            console.error('Erro ao buscar funcionários:', error);
            throw error;
        }
    },

    // Buscar espelho de pontos via proxy
    getEspelhoPonto: async (
        token: string,
        empresa: string,
        idFuncionario: string,
        dataInicio: string,
        dataFim: string
    ) => {
        try {
            const url = `/api/espelho-ponto?token=${encodeURIComponent(token)}&empresa=${encodeURIComponent(empresa)}&idFuncionario=${idFuncionario}&dataInicio=${dataInicio}&dataFim=${dataFim}`;

            const response = await fetch(url);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `Erro HTTP: ${response.status}`);
            }

            const data = await response.json();
            return data as EspelhoPonto;
        } catch (error) {
            console.error('Erro ao buscar espelho de pontos:', error);
            throw error;
        }
    },

    // Buscar batidas via proxy
    getBatidas: async (
        token: string,
        empresa: string,
        dataInicio: string,
        dataFim: string,
        pagina: number = 1
    ) => {
        try {
            const url = `/api/batidas?token=${encodeURIComponent(token)}&empresa=${encodeURIComponent(empresa)}&dataInicio=${dataInicio}&dataFim=${dataFim}&pagina=${pagina}`;

            const response = await fetch(url);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `Erro HTTP: ${response.status}`);
            }

            const data = await response.json();
            return data as BatidasResponse;
        } catch (error) {
            console.error('Erro ao buscar batidas:', error);
            throw error;
        }
    }
};