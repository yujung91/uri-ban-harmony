# Supabase 연동 준비 · 새 Vercel 프로젝트 전용

이 코드와 SQL은 로컬 준비본입니다. 기존 ChatGPT Sites·D1·R2는 읽거나 변경하지
않습니다. 실제 학생 자료를 가져오는 도구나 시드 데이터는 포함하지 않습니다.
아직 원격 SQL 실행, GitHub 반영, Vercel 배포를 수행하지 않았습니다.

## 데이터와 권한

- `supabase/migrations/0001_harmony.sql`: 기존 SQLite 마이그레이션 4개를 합친
  PostgreSQL 테이블 18개. 기존 camelCase 열, 정수 플래그, JSON 문자열을 유지해
  서버 로직을 재사용합니다. 밀리초 시간은 bigint이며 서버에서 안전한 숫자로 변환합니다.
- 별도 `harmony` 스키마와 RLS를 사용합니다. `anon`·`authenticated`에는 스키마와
  테이블 권한이 없고 클라이언트 RLS 정책도 없습니다. Supabase Data API의
  exposed schemas에 `harmony`를 추가하지 마세요.
- 서버 DB 연결은 새 프로젝트의 관리자 DB 역할로만 사용합니다. 이 연결은 RLS를
  우회하므로 모든 사용자 요청은 서버의 기존 학급 소유권·학생 토큰 검사를 거칩니다.
  학생은 다른 학생의 초안·원본·비공개 그림을 조회/수정할 수 없습니다. 기존 기능대로
  학급 최종 선정 작품과 그 그림은 같은 학급에서 함께 감상할 수 있습니다.
- 출석번호+4자리 PIN은 기존 PBKDF2-SHA256(100,000회)+개별 salt 방식입니다.
  DB에는 해시만 저장하며, 학생 세션 토큰도 해시·만료·인증 버전으로 검사합니다.
  PIN 재발급은 기존 세션을 폐기하고 작품은 유지합니다. 자동 저장 충돌 검사,
  제출 원본과 교사 수정본, 휴지통, 선정 취소도 기존 로직을 재사용합니다.
- `0002_private_storage.sql`: `harmony-media` 비공개 버킷, 파일당 10MB 제한.
  공개 URL·클라이언트 Storage 정책 없이 권한 검사된 서버 API로만 파일을 제공합니다.
  기존 그림 업로드 제한은 2MB입니다. DB와 Storage는 단일 트랜잭션이 아니므로
  파일 업로드 실패는 재시도해야 하며 운영 전 실패·삭제 시나리오를 점검해야 합니다.
  Vercel 함수의 요청 크기 제한도 적용되므로 큰 영상의 기존 10MB 업로드를 그대로
  보장하지는 않습니다. 수업 운영 전 큰 파일은 권한 검사 후 직접 업로드하는 방식과
  별도 검증이 필요합니다. 음악 영상의 브라우저 내 생성·다운로드 코드는 유지합니다.

## 나중에 사용자가 설정할 항목 — 지금은 실행하지 않아도 됩니다

새 Supabase 프로젝트 `uri-ban-harmony`인지 먼저 확인합니다.

1. SQL Editor에서 `0001_harmony.sql`, `0002_private_storage.sql` 순서로 실행합니다.
   SQL은 테스트 계정이나 작품을 만들지 않습니다. 기존 D1 SQL은 실행하지 않습니다.
2. Authentication에서 이메일/비밀번호 로그인을 사용하고 **새 사용자 공개 가입을
   비활성화**합니다. Users에서 본인 교사 계정만 수동 생성·이메일 확인합니다.
   현재 확인된 Supabase 사용자 계정은 교사로 취급하므로 가입 제한을 유지해야 합니다.
   학생은 Supabase Auth 계정이 아니라 교사가 발급하는 출석번호·PIN으로 로그인합니다.
3. Authentication URL Configuration의 Site URL을 새 Vercel 주소로 설정합니다.
   이번 구현은 이메일/비밀번호 서버 로그인이며 OAuth·매직링크는 사용하지 않습니다.
4. Vercel에 아래 **서버 환경변수**를 설정합니다. 값은 환경 설정 화면에서만 입력하고
   채팅·GitHub·`.env.example` 등에 비밀값을 붙이지 마세요.

| 변수 | 설정 |
|---|---|
| `SUPABASE_URL` | `https://hnreiqglaoctqvunyvka.supabase.co` |
| `SUPABASE_DATABASE_URL` | Connect → Transaction pooler의 PostgreSQL 연결 문자열. 새 프로젝트의 DB 비밀번호를 URL 인코딩하여 사용. 6543 포트. 서버 전용이며 이 앱은 prepared statements를 사용하지 않음 |
| `SUPABASE_ANON_KEY` | 새 프로젝트 API 설정의 anon 키. 서버에서 Auth 호출에 사용 |
| `SUPABASE_SERVICE_ROLE_KEY` | 새 프로젝트의 service_role 키. 서버 Storage 접근 전용, 절대 프런트엔드에 노출하지 않음 |
| `SUPABASE_STORAGE_BUCKET` | 선택. 기본 `harmony-media`; SQL과 일치해야 함 |
| `SUPABASE_DB_CA` | 선택. 기본 신뢰 체인으로 DB TLS 검증이 안 될 때 Supabase가 제공하는 공식 CA PEM. TLS 검증은 끄지 않음 |
| `TEACHER_EMAIL` | 선택. 점검 계정 사용을 차단할 수 있는 사이트 소유자 이메일. 일반 교사의 자기 학급 관리에는 불필요 |
| `REVIEW_USERNAME` | 선택. 점검용 로그인 이름. 기본값 `demo` |
| `REVIEW_PASSWORD_HASH` | 선택. 새 점검 비밀번호의 `salt:PBKDF2-SHA256 100000회 32바이트 hex` 형식. 원문을 저장하지 않음 |
| `REVIEW_SESSION_SECRET` | 선택. 새 환경 전용 무작위 서명 비밀값. 점검 계정을 사용하려면 해시와 함께 필요 |

어떤 비밀키에도 `NEXT_PUBLIC_` 접두사를 붙이지 마세요. 기존 Sites 비밀값을
재사용하지 않습니다. 계정 비밀번호·DB 비밀번호·점검 비밀번호는 서로 다르게 관리합니다.
교사 로그인은 기존 버튼 URL을 새 서버 로그인 폼으로 연결합니다. Supabase가
매 요청마다 세션을 검증하고, HttpOnly 쿠키·세션 갱신·서버 로그인 횟수 제한·Origin
검사를 사용합니다. 클라이언트의 Sites 신원 헤더는 제거한 뒤 검증된 신원만 주입합니다.
현재는 비밀번호 변경·분실 재설정 화면을 별도로 제공하지 않으며 Supabase 관리 화면을
사용합니다. 운영 전 계정/세션과 로그인 메일 설정도 점검하세요.
`scripts/run-vercel.mjs`가 Next.js에만 로그인 경로 연결을 활성화하므로 기존
Sites/Vinext의 플랫폼 로그인 경로는 재작성하지 않습니다.

## 로컬 검증

```sh
npm run install:ci
node scripts/test-supabase.mjs
node scripts/test-supabase-services.mjs
node scripts/test-lyric-ime.mjs
npm run build:vercel
node scripts/test-vercel.mjs
```

PostgreSQL 검증은 PGlite의 로컬 PostgreSQL 엔진에서 기존 classroom·creation·reviewer
테스트의 모든 업무 검증을 그대로 실행합니다. 비동기 DB 호출만 변환하고 SQLite 대신
새 SQL/어댑터를 사용합니다. Auth·Storage는 로컬 모의 응답으로 검증합니다.
따라서 실제 Supabase 네트워크·TLS·키 권한·Storage 서비스 동작, Vercel에서의 연결과
브라우저 녹화까지 확인한 것은 아닙니다. 원격 설정 후 테스트 학급으로 별도 확인해야 합니다.

다음 행동: **이 문서의 환경변수 목록을 기준으로 새 프로젝트 설정 항목을 확인해 주세요.**
SQL 적용·배포는 준비본을 검토한 뒤 별도 진행합니다. 비밀값을 채팅에 보내지 마세요.
