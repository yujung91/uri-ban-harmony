# 집 PC에서 이어서 작업하기

GitHub 소스 저장소: https://github.com/yujung91/uri-ban-harmony (비공개)

운영 사이트: https://uri-ban-harmony-20261103.soyoutheai.chatgpt.site/

## 준비와 다운로드

집 PC에 Git과 Node.js 24 LTS를 설치하고, GitHub 계정 `yujung91`로 저장소에 접근합니다.

```sh
git clone https://github.com/yujung91/uri-ban-harmony.git
cd uri-ban-harmony
npm run install:ci
```

프로젝트 폴더를 편집기나 작업 도구에서 열면 이어서 수정할 수 있습니다. 처음부터 다시 만들 필요는 없습니다.

## 집 PC에서 실행하기

아래 명령은 새로 내려받은 폴더의 빈 로컬 DB를 처음 준비할 때 실행합니다.

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_even_ben_grimm.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_overrated_ultragirl.sql
```

두 SQL은 새 로컬 DB에 한 번만 적용합니다. 이미 적용한 DB에 반복 실행하지 마세요. 이후 새 마이그레이션이 추가되면 새 파일만 순서대로 적용합니다.

로컬 교사 로그인을 시험하려면 프로젝트 루트에 `.dev.vars` 파일을 만들고 아래 한 줄을 넣습니다. 이 파일은 GitHub에 올리지 않습니다.

```dotenv
TEACHER_EMAIL="seedy@sites.test"
```

```sh
npm run dev -- --port 4173 --hostname 127.0.0.1
```

http://127.0.0.1:4173 에서 사이트를 엽니다. 로컬 ‘선생님 로그인’은 테스트 계정으로 동작합니다. 학생 화면은 시크릿 창이나 다른 브라우저에서 숫자 코드로 접속해 확인합니다. 다음 실행부터는 `npm run dev`만 실행하면 됩니다.

집 PC의 로컬 DB는 운영 중인 학급 DB와 분리되어 있습니다. 로컬에서 학급이 비어 있는 것은 정상입니다. 실제 학급은 운영 사이트에 그대로 있습니다.

## 변경 저장

```sh
git add .
git commit -m "Describe the change"
git push origin main
```

비밀번호·토큰·`.dev.vars`·`.env`·학생 백업 파일은 GitHub에 올리지 않습니다. 저장소에는 프로그램 소스와 예시 그림만 포함합니다.

## 기존 사이트에 다시 배포하기

GitHub는 소스 보관용이고, 실제 실행·DB·파일 저장은 기존 Sites에서 담당합니다. **GitHub에 push하는 것만으로 운영 사이트가 자동 배포되지는 않습니다.**

기존 사이트를 관리하는 동일한 계정에서 이 프로젝트를 열고 다음과 같이 요청하면 됩니다.

> 이 저장소의 변경을 기존 우리 반 하모니 Sites에 배포해줘. `.openai/hosting.json`의 project_id를 유지하고, 새 사이트를 만들거나 운영 학급 데이터를 초기화하지 마. 공개 접속 범위와 기존 DB·R2 파일을 유지해줘. 실행·검증 방법은 HOME_SETUP.md와 HANDOFF.md에 있어.

배포 시 `.openai/hosting.json`을 유지해야 합니다. 이 앱은 D1/R2와 서버 권한 검사를 사용하므로 GitHub Pages 같은 정적 호스팅에 그대로 올리면 학급 기능이 작동하지 않습니다.

## 확인 명령

```sh
node scripts/test-classroom.mjs
npx tsc --noEmit
npm run build
```

백엔드 테스트에는 Node.js의 `node:sqlite`가 필요하므로 Node.js 24를 권장합니다.
