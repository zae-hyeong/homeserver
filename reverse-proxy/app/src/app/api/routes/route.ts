import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const routesFilePath = path.join(process.cwd(), 'routes.json');

// routes.json 데이터 로드 헬퍼
function getRoutes(): any[] {
  if (!fs.existsSync(routesFilePath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(routesFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading routes.json:', error);
    return [];
  }
}

// routes.json 데이터 저장 헬퍼
function saveRoutes(routes: any[]) {
  try {
    fs.writeFileSync(routesFilePath, JSON.stringify(routes, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing routes.json:', error);
  }
}

export async function GET() {
  const routes = getRoutes();
  return NextResponse.json(routes);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, sourceHost, destinationUrl, description } = body;
    
    if (!name || !sourceHost || !destinationUrl) {
      return NextResponse.json(
        { error: '필수 항목(이름, 요청 도메인, 대상 주소)이 누락되었습니다.' },
        { status: 400 }
      );
    }
    
    // URL 형식 확인 (http:// 또는 https:// 로 시작하는지)
    if (!/^https?:\/\//.test(destinationUrl)) {
      return NextResponse.json(
        { error: '대상 주소는 http:// 또는 https:// 로 시작해야 합니다.' },
        { status: 400 }
      );
    }
    
    const routes = getRoutes();
    
    // 소스 호스트 중복 체크
    if (routes.some(r => r.sourceHost.toLowerCase() === sourceHost.toLowerCase())) {
      return NextResponse.json(
        { error: '이미 등록된 요청 도메인(Host)입니다.' },
        { status: 400 }
      );
    }
    
    const newRoute = {
      id: Date.now().toString(),
      name,
      sourceHost: sourceHost.trim(),
      destinationUrl: destinationUrl.trim(),
      active: true,
      description: description || ''
    };
    
    routes.push(newRoute);
    saveRoutes(routes);
    
    return NextResponse.json(newRoute, { status: 201 });
  } catch (err) {
    console.error('POST Route error:', err);
    return NextResponse.json({ error: '요청 처리에 실패했습니다.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, sourceHost, destinationUrl, active, description } = body;
    
    if (!id) {
      return NextResponse.json({ error: '대상 ID가 누락되었습니다.' }, { status: 400 });
    }
    
    if (destinationUrl && !/^https?:\/\//.test(destinationUrl)) {
      return NextResponse.json(
        { error: '대상 주소는 http:// 또는 https:// 로 시작해야 합니다.' },
        { status: 400 }
      );
    }
    
    const routes = getRoutes();
    const index = routes.findIndex(r => r.id === id);
    
    if (index === -1) {
      return NextResponse.json({ error: '해당 설정을 찾을 수 없습니다.' }, { status: 404 });
    }
    
    // 중복 체크 (수정된 도메인이 자신 이외의 다른 도메인과 겹치는지)
    if (sourceHost && routes.some(r => r.id !== id && r.sourceHost.toLowerCase() === sourceHost.toLowerCase())) {
      return NextResponse.json(
        { error: '이미 등록된 다른 요청 도메인(Host)입니다.' },
        { status: 400 }
      );
    }
    
    // 정보 업데이트
    routes[index] = {
      ...routes[index],
      name: name !== undefined ? name : routes[index].name,
      sourceHost: sourceHost !== undefined ? sourceHost.trim() : routes[index].sourceHost,
      destinationUrl: destinationUrl !== undefined ? destinationUrl.trim() : routes[index].destinationUrl,
      active: active !== undefined ? active : routes[index].active,
      description: description !== undefined ? description : routes[index].description
    };
    
    saveRoutes(routes);
    return NextResponse.json(routes[index]);
  } catch (err) {
    console.error('PUT Route error:', err);
    return NextResponse.json({ error: '요청 처리에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: '대상 ID가 누락되었습니다.' }, { status: 400 });
    }
    
    const routes = getRoutes();
    const updatedRoutes = routes.filter(r => r.id !== id);
    
    if (routes.length === updatedRoutes.length) {
      return NextResponse.json({ error: '해당 설정을 찾을 수 없습니다.' }, { status: 404 });
    }
    
    saveRoutes(updatedRoutes);
    return NextResponse.json({ message: '성공적으로 삭제되었습니다.' });
  } catch (err) {
    console.error('DELETE Route error:', err);
    return NextResponse.json({ error: '요청 처리에 실패했습니다.' }, { status: 500 });
  }
}
