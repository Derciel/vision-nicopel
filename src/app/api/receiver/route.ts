import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('📥 Dados recebidos via POST:');
    console.dir(body, { depth: null });
    
    return NextResponse.json({ status: 'success', received: true });
  } catch (error) {
    console.error('❌ Erro ao processar POST:', error);
    return NextResponse.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const data = Object.fromEntries(searchParams.entries());
  
  console.log('📥 Dados recebidos via GET:');
  console.table(data);
  
  return NextResponse.json({ status: 'success', data });
}
