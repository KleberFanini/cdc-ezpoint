import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        console.log('Proxy login - enviando requisição');

        // Aumentar timeout para 30 segundos
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch('https://api.ezpointweb.com.br/ezweb-ws/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const text = await response.text();

        console.log('Proxy login - resposta recebida (status:', response.status, ')');

        // Tentar fazer parse como JSON
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            data = { token: text };
        }

        return NextResponse.json(data, { status: response.status });

    } catch (error: any) {
        console.error('Proxy login - erro:', error);

        if (error.name === 'AbortError') {
            return NextResponse.json(
                { error: 'Tempo limite excedido. O servidor demorou muito para responder.' },
                { status: 408 }
            );
        }

        return NextResponse.json(
            { error: 'Erro ao conectar com a API', details: error.message },
            { status: 500 }
        );
    }
}