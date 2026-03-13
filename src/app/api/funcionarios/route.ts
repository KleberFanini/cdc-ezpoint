import { NextResponse } from 'next/server';
import { cacheService } from '@/services/cacheService';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');
        const empresa = searchParams.get('empresa');
        const ocultarDemitidos = searchParams.get('ocultarDemitidos') === 'true';
        const forceRefresh = searchParams.get('forceRefresh') === 'true';

        if (!token || !empresa) {
            return NextResponse.json(
                { error: 'Token e empresa são obrigatórios' },
                { status: 400 }
            );
        }

        // Criar chave única para o cache
        const cacheKey = `funcionarios_${empresa}_${ocultarDemitidos}`;

        // Se não forçar refresh, tentar pegar do cache
        if (!forceRefresh) {
            const cachedData = cacheService.get<any>(cacheKey);
            if (cachedData) {
                console.log('Proxy funcionarios - Retornando dados do cache');
                return NextResponse.json(cachedData);
            }
        }

        let url = `https://api.ezpointweb.com.br/ezweb-ws/funcionario?empresa=${empresa}`;
        if (ocultarDemitidos) {
            url += `&ocultarDemitidos=true`;
        }

        console.log('Proxy funcionarios - URL:', url);

        // Tentar até 3 vezes com delay entre tentativas
        let tentativas = 0;
        const maxTentativas = 3;
        let lastError;

        while (tentativas < maxTentativas) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos

                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`Proxy funcionarios - Tentativa ${tentativas + 1} - Erro HTTP:`, response.status);

                    if (response.status === 502 || response.status === 504 || response.status === 408) {
                        // Erros de gateway/timeout, tentar novamente
                        tentativas++;
                        if (tentativas < maxTentativas) {
                            console.log(`Tentativa ${tentativas + 1} de ${maxTentativas}...`);
                            // Aguardar 2 segundos antes de tentar novamente
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            continue;
                        }
                    }

                    return NextResponse.json(
                        { error: `Erro HTTP: ${response.status}` },
                        { status: response.status }
                    );
                }

                const data = await response.json();

                // Salvar no cache por 5 minutos
                cacheService.set(cacheKey, data, 5);

                return NextResponse.json(data);

            } catch (fetchError: any) {
                lastError = fetchError;
                tentativas++;

                if (fetchError.name === 'AbortError') {
                    console.error(`Proxy funcionarios - Tentativa ${tentativas} - Timeout`);
                } else {
                    console.error(`Proxy funcionarios - Tentativa ${tentativas} - Erro:`, fetchError.message);
                }

                if (tentativas < maxTentativas) {
                    console.log(`Tentativa ${tentativas + 1} de ${maxTentativas} após erro...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }

        // Se chegou aqui, todas as tentativas falharam
        console.error('Proxy funcionarios - Todas as tentativas falharam:', lastError);

        // Tentar retornar cache expirado como fallback
        const expiredCache = cacheService.get<any>(cacheKey);
        if (expiredCache) {
            console.log('Proxy funcionarios - Retornando cache expirado como fallback');
            return NextResponse.json({
                ...expiredCache,
                _fallback: true,
                _message: 'Usando dados em cache - API temporariamente indisponível'
            });
        }

        return NextResponse.json(
            { error: 'API do EZPoint instável. Tente novamente em alguns instantes.' },
            { status: 503 }
        );

    } catch (error: any) {
        console.error('Proxy funcionarios - Erro:', error);
        return NextResponse.json(
            { error: 'Erro ao conectar com a API', details: error.message },
            { status: 500 }
        );
    }
}