import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const routesFilePath = path.join(process.cwd(), 'routes.json');

function getRoutes(): any[] {
  if (!fs.existsSync(routesFilePath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(routesFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// 개별 서비스의 헬스 상태 확인 (비동기 Fetch, 1.5초 타임아웃)
async function checkHealth(url: string): Promise<'online' | 'offline'> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    
    // HEAD 또는 GET 요청을 날려 타겟 서버가 응답하는지 검사
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Antigravity-Proxy-Health-Checker/1.0',
        'Cache-Control': 'no-cache'
      },
      next: { revalidate: 0 } // Next.js 캐싱 방지
    });
    
    clearTimeout(timeoutId);
    
    // 응답 코드가 5xx 에러가 아닌 이상 연결은 성립된 것으로 보고 online 판정
    if (response.status < 500) {
      return 'online';
    }
    return 'offline';
  } catch (error) {
    return 'offline';
  }
}

export async function GET() {
  const routes = getRoutes();
  const healthStatuses: Record<string, 'online' | 'offline'> = {};
  
  // 병렬로 헬스체크 진행
  const checkPromises = routes.map(async (route) => {
    if (!route.active) {
      healthStatuses[route.id] = 'offline';
      return;
    }
    healthStatuses[route.id] = await checkHealth(route.destinationUrl);
  });
  
  await Promise.all(checkPromises);
  
  return NextResponse.json(healthStatuses, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
    }
  });
}
