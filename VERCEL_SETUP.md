# Vercel 이전 1단계

후속 Supabase 코드·SQL 준비와 현재 설정 안내는 [SUPABASE_SETUP.md](SUPABASE_SETUP.md)를
참고하세요. 아래 내용은 Supabase 환경변수가 없는 1단계 화면 확인 절차입니다.

기존 Sites와 별개인 새 Vercel 프로젝트용입니다. `.openai/hosting.json`, 기존 D1/R2,
운영 비밀변수와 학생 자료는 변경하거나 가져오지 않습니다.

## 로컬 실행

Node.js 24 LTS에서 저장소 루트에서 실행합니다.

```sh
npm ci --include=dev --include=optional --no-audit --no-fund
npm run dev:vercel -- --hostname 127.0.0.1 --port 4180
```

프로덕션 빌드와 검증:

```sh
npm run build:vercel
node scripts/test-vercel.mjs
# 직접 실행할 때
npm run start:vercel -- --hostname 127.0.0.1 --port 4180
```

현재는 기존 화면·CSS·작곡/그림/영상 스크립트가 제공됩니다. 상단에 준비 중 안내가
표시됩니다. 로그인·자동 저장·학급 관리·파일 업로드의 종단 간 동작은 다음 단계의
Supabase 연결 후 검증합니다. 기존 기능을 삭제하거나 가짜 저장 성공을 반환하지 않습니다.
`/api/me`는 익명 상태를 반환하고 다른 API는 503 `BACKEND_NOT_CONFIGURED`로 응답합니다.
기존 ChatGPT 로그인 링크는 아직 새 환경에서 지원하지 않습니다.

Next.js의 webpack 설정에서만 Cloudflare 모듈을 비어 있는 새 환경 어댑터로 대체합니다.
`?raw` HTML도 webpack에서 처리하므로 `--webpack` 옵션을 유지합니다.
기존 `npm run dev`, `npm run build`, `npm start`는 Sites용으로 남겨 둡니다.
Next.js 빌드는 `.next`, Sites 빌드는 `dist`를 사용합니다.
두 프레임워크가 `.next/types`의 경로 타입을 생성하므로 Sites 빌드 후 Next.js
타입 검사를 할 때는 `npx --no-install next typegen`으로 타입을 재생성한 뒤
`npx --no-install tsc --noEmit`을 실행합니다.

## Vercel 계정에서 할 일

이 변경을 GitHub에 반영한 후, Vercel에서 해당 저장소를 새 프로젝트로 가져옵니다.
Framework는 Next.js, Node.js는 24.x, Root Directory는 저장소 루트입니다.
`vercel.json`의 설치·빌드 명령을 사용하고 Output Directory는 Next.js 기본값으로 둡니다.
이 단계에는 환경변수가 필요하지 않습니다. 기존 Cloudflare/Sites 비밀값은 복사하지 않습니다.
현재 화면 확인용이며 수업에 사용할 완성 배포본은 아닙니다.

다음 단계에서 별도 Supabase 프로젝트의 테스트 DB·비공개 파일 저장소·교사 인증을
연결합니다. 서버 비밀키는 Vercel의 서버 환경변수에만 넣고 `NEXT_PUBLIC_` 접두사를
사용하지 않습니다. 학생·교사 권한, 자동 저장 충돌 처리, 파일 접근과 영상 생성까지
검증한 후 수업용으로 전환합니다. 이번 단계에는 Supabase 자원을 생성하지 않습니다.
