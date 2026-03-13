import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get('token');
        const empresa = searchParams.get('empresa');
        const idFuncionario = searchParams.get('idFuncionario');
        const dataInicio = searchParams.get('dataInicio');
        const dataFim = searchParams.get('dataFim');

        if (!token || !empresa || !idFuncionario || !dataInicio || !dataFim) {
            return NextResponse.json(
                { error: 'Parâmetros obrigatórios faltando' },
                { status: 400 }
            );
        }

        const url = `https://api.ezpointweb.com.br/ezweb-ws/espelhoDePontos?idFuncionario=${idFuncionario}&empresa=${empresa}&dataInicio=${dataInicio}&dataFim=${dataFim}`;

        console.log('Proxy espelho - URL:', url);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Proxy espelho - Erro HTTP:', response.status, errorText);
            return NextResponse.json(
                { error: `Erro HTTP: ${response.status}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Proxy espelho - Erro:', error);
        return NextResponse.json(
            { error: 'Erro ao conectar com a API', details: error.message },
            { status: 500 }
        );
    }
}