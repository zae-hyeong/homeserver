# 1. 기존 의존성 파일들 완전히 강제 삭제
Remove-Item -Recurse -Force node_modules, package-lock.json

# 2. npm 캐시 강제 청소
npm cache clean --force

# 3. 깨끗한 상태에서 의존성 및 락 파일 새로 생성
npm install

# 4. 새로 빌드된 파일만 반영하여 깃허브 원격 저장소로 전송
git add package-lock.json Dockerfile
git commit -m "fix: node version match and reset package-lock"
git push origin main