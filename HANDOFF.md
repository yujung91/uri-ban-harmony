# 이어서 작업할 때 확인할 내용

- 2026-11-05 추가 변경: DELETION_LYRICS_UPDATE.md를 먼저 확인합니다. 제출 작품 삭제 조건·휴지통 완전삭제·수업 보관 삭제·무료 가사 도움이 추가되었습니다.

## 운영 연결 유지

- 현재 코드 기준: 2026-11-04 수업 후 개선. 최신 동작과 검증은 CLASSROOM_IMPROVEMENTS.md, 집 PC 요청문은 HOME_PC_PROMPT.md를 우선 읽습니다.
- 기존 사이트 project_id: `.openai/hosting.json`을 그대로 사용합니다.
- 서버: Sites Vinext/Cloudflare Workers. DB binding `DB`, 파일 binding `BUCKET`.
- 사이트 접속 범위는 공개입니다. 학급 자료는 학생 개인 토큰 또는 소유 교사의 플랫폼 로그인으로 권한을 검사합니다.
- `TEACHER_EMAIL`은 Sites에 비밀 환경변수로 이미 설정되어 있습니다. 값을 소스에 쓰거나 다른 계정으로 바꾸지 않습니다. 일반 교사 로그인은 이 이메일 허용목록에 제한되지 않으며, 각 학급 owner로 권한을 분리합니다.
- 새 사이트를 만들거나 운영 데이터베이스를 로컬 DB로 덮어쓰지 않습니다.

## 코드 위치

| 위치 | 역할 |
|---|---|
| `app/lib/classroom.ts` | 교사/학생 권한, 학급 입장, DB/R2, 수정 이력, 버전 저장 API |
| `app/api/[...path]/route.ts` | API 라우팅 |
| `app/route.ts`, `public/classroom.html` | 앱 진입 HTML |
| `public/app.js`, `public/online.js` | 기본 화면, 네트워크 동기화, 프로젝트 설정 |
| `public/studio.js` | 그림 약속 카드, 그림 도구, 가사·작곡 제출, 교사 편집, 로그인 선택, 매뉴얼 |
| `public/music.js` | 4마디 작곡, 예시 멜로디 4종, Web Audio 연주 |
| `public/movie.js` | 곡·가사·장면 구성, 마디에 맞춘 영상 재생·녹화 |
| `public/assets/rule-atlas.png` | AI로 미리 생성한 상황 그림 6종. 실행 중 AI API 호출 없음 |
| `db/schema.ts`, `drizzle/` | 스키마와 적용 순서가 있는 마이그레이션 |
| `scripts/test-classroom.mjs` | SQLite 기반 권한·투표·원본 보존·영상 구성 테스트 |

## 현재 동작과 중요한 제약

- 숫자 8자리 코드, 자동 별명, 약속 제안·승인·숨김·투표·최종 선정.
- 가사·4마디 멜로디·그림이 주요 창작 활동. 음성 녹음/신규 음성 제출은 제거했습니다.
- 학생 작품 투표는 없습니다. 교사가 학생들과 소통하고 직접 고릅니다.
- 교사는 모든 제출물을 확인·필터링·수정할 수 있습니다. 첫 학생 원본과 수정 이력을 유지하고 원본 복원을 지원합니다.
- 곡의 BPM·마디에 맞춰 그림과 가사 자막이 나옵니다. WebM으로 저장하며, 자동 가창은 없습니다.
- 학생/교사용 매뉴얼과 교사의 학생 화면 미리보기를 지원합니다. 미리보기는 실제 학생 제출을 생성하지 않습니다.
- 초대 코드 변경 후에도 기존 학생 토큰과 제출물은 유지됩니다.
- 원본이 포함된 DB 마이그레이션은 이미 운영에 적용되어 있습니다. 기존 SQL/Drizzle 메타데이터를 수정하지 말고 새 마이그레이션을 추가합니다.

## 검증과 배포

`HOME_SETUP.md`에 설치·로컬 마이그레이션·실행 명령이 있습니다. 변경에 맞는 테스트를 실행합니다. 학급 권한 또는 DB 구조를 변경하면 `node scripts/test-classroom.mjs`도 실행합니다.

Sites 스킬의 기존 사이트 워크플로를 사용해 소스를 동기화하고 빌드/패키징한 뒤 saved version을 배포합니다. 사이트가 공개 상태이므로 현재 audience를 확인하고 공개 사이트용 배포 작업을 사용합니다. GitHub 원격과 Sites 소스 원격은 별개이며, 어느 쪽에도 force push를 하지 않습니다.

GitHub에 백업한 소스에는 운영 학급 데이터·학생 파일·환경변수 값이 없습니다. 운영 데이터는 기존 Sites의 D1/R2에 남아 있습니다.

### GitHub clone에서 배포할 때의 Git 이력

GitHub 저장소와 Sites 저장소는 같은 파일을 보관하지만 커밋 이력은 다릅니다. GitHub clone에서 Sites helper를 바로 열면 이력 불일치가 발생할 수 있습니다. 강제 push나 관계없는 이력 병합으로 우회하지 않습니다.

1. 기존 `.openai/hosting.json`에서 project_id를 읽고 get_site 및 create_source_repository_write_credential을 호출합니다.
2. 비어 있는 별도 작업 폴더에서 Sites source helper를 `archivePath` 없이 실행해 기존 운영 소스를 엽니다. 반환된 checkout_path/source 결과를 유지합니다.
3. GitHub clone의 추적 중인 소스 파일을 Sites checkout에 반영합니다. `.git`, `node_modules`, `.wrangler`, `.sites-runtime`, `.dev.vars*`, `.env*`, 생성된 빌드 결과는 복사하지 않습니다. 원본 Sites hosting.json의 project_id와 현재 바인딩을 유지합니다. 삭제한 소스 파일이 있다면 해당 변경도 검토해 반영합니다.
4. Sites checkout에서 필요한 의존성 설치와 검증·빌드를 진행합니다. DB 스키마가 바뀌었다면 새 마이그레이션을 추가합니다.
5. 기존 opening source 결과와 같은 사이트의 credential로 패키징/소스 push를 수행한 뒤, 반환된 commit_sha/archive를 그대로 저장·배포합니다.
6. GitHub 원본 폴더에는 기능 수정과 테스트 결과를 커밋·push합니다. Sites의 Git 메타데이터를 GitHub 폴더로 덮어쓰지 않습니다.
