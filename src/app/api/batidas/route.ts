import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');
        const empresa = searchParams.get('empresa');
        const dataInicio = searchParams.get('dataInicio');
        const dataFim = searchParams.get('dataFim');
        const pagina = searchParams.get('pagina') || '1';

        if (!token || !empresa || !dataInicio || !dataFim) {
            return NextResponse.json(
                { error: 'Parâmetros obrigatórios faltando' },
                { status: 400 }
            );
        }

        const url = `https://api.ezpointweb.com.br/ezweb-ws/batida?empresa=${empresa}&pagina=${pagina}&dataInicio=${dataInicio}&dataFim=${dataFim}`;

        console.log('Proxy batidas - URL:', url);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        // Tentar ler o corpo da resposta mesmo em caso de erro
        const responseText = await response.text();
        console.log('Proxy batidas - Status:', response.status);
        console.log('Proxy batidas - Resposta:', responseText.substring(0, 200));

        if (!response.ok) {
            return NextResponse.json(
                {
                    error: `Erro HTTP: ${response.status}`,
                    details: responseText,
                    status: response.status
                },
                { status: response.status }
            );
        }

        // Tentar fazer parse do JSON
        try {
            const data = JSON.parse(responseText);
            return NextResponse.json(data);
        } catch (e) {
            return NextResponse.json(
                {
                    error: 'Resposta inválida da API',
                    details: responseText.substring(0, 200)
                },
                { status: 500 }
            );
        }

    } catch (error: any) {
        console.error('Proxy batidas - Erro:', error);
        return NextResponse.json(
            { error: 'Erro ao conectar com a API', details: error.message },
            { status: 500 }
        );
    }
}