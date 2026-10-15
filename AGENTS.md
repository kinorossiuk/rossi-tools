# ROSSI TOOLS 작업 지침

## 저장소 기준

- 원격 저장소: `https://github.com/kinorossiuk/wp_sms_api_reminder`
- 작업 시작 시 현재 디렉터리에 Git 메타데이터가 없으면 위 원격 저장소의 `main`을 기준으로 복구·동기화한다.
- GitHub 푸시는 SSH 원격 `git@github.com:kinorossiuk/wp_sms_api_reminder.git`와 `/home/khadas/.ssh/wp_sms_api_reminder` 키를 `IdentitiesOnly=yes`로 사용한다. 키 내용·비밀값은 출력하거나 커밋하지 않는다.
- GitHub 키 지문은 `SHA256:yDdYXy8gPdmkryrh8YBCW2huaZwYXbigdlE0cwEI3h4`이며, `wp_sms_api_reminder`에 읽기·쓰기 권한이 있다.
- cPanel 운영 배포용 키는 `/home/khadas/.ssh/rossiuk_cpanel_deploy`이며, GitHub 푸시에는 사용하지 않는다.

## 완료 및 배포

- 코드 변경 작업을 마칠 때 최종 응답에 `배포 상태`를 반드시 적는다.
- 사용자가 배포, 릴리스, 커밋·푸시·태그 또는 마무리를 요청한 경우 구현과 검증에서 멈추지 말고 아래 절차를 끝까지 수행한다.
  1. 작업과 관련된 파일만 검토하고 검사한다.
  2. `main`의 최신 원격 이력 위에 커밋한다.
  3. 커밋을 `origin/main`에 푸시한다.
  4. 기존 태그를 확인하고 변경 성격에 맞는 주석 태그를 생성해 푸시한다.
  5. 원격의 브랜치와 태그가 새 커밋을 가리키는지 다시 확인한다.
- GitHub 푸시와 운영 배포를 같은 것으로 취급하지 않는다. 운영 반영은 cPanel Git Version Control에서 `Update from Remote`와 `Deploy HEAD Commit`을 순서대로 실행해야 완료된다.
- cPanel에 접근할 수 없으면 GitHub 반영까지만 완료했다고 명확히 적고, 남은 두 작업을 사용자에게 안내한다.
- `.ssh`, API 키, 비밀번호, 웹 루트 밖의 운영 설정 파일은 절대 커밋하지 않는다.
- 네트워크, 권한 또는 Git 이력 문제로 배포하지 못하면 완료했다고 표현하지 말고 정확한 차단 원인과 보존된 변경 상태를 보고한다.
