# 개발 가이드

사용법과 API는 [README](README.md)를 참고하세요.

## 저장소 구조

```
packages/react-file-preview/   npm에 배포되는 라이브러리
  src/core/                 상태 컨트롤러, 파일 판별, 로딩, 설정, 단축키, Content
  src/ui/                   compound 부품 (Toolbar, ZoomIn, Thumbnails, SheetTabs, Preset …)
  src/renderers/            포맷별 렌더러 (pdf, docx, sheet, image, media, text)
  src/styles.css            디자인 토큰 + 기본 테마 (cascade layer)
  test/                     단위 테스트 (vitest)
apps/playground/            개발용 데모 앱 (Vite)
scripts/generate-fixtures.mjs  샘플 파일 생성기
```

## 개발

```bash
pnpm install
pnpm fixtures      # 샘플 파일 생성 (apps/playground/public/samples)
pnpm dev           # 플레이그라운드 http://localhost:5178 (라이브러리 소스를 직접 사용, HMR)
pnpm test          # 단위 테스트
pnpm typecheck
pnpm build         # packages/react-file-preview/dist 생성
```

빌드된 패키지로 플레이그라운드를 확인하려면 다음처럼 실행합니다.

```bash
pnpm build && USE_DIST=1 pnpm --filter playground exec vite
```

## README 수정

README의 원본은 `packages/react-file-preview/README.md`입니다(npm 페이지에 표시됨). 수정한 뒤 아래 명령으로 루트 `README.md`(GitHub에 표시됨)에 복사하세요. 두 파일이 다르면 CI가 실패합니다.

```bash
pnpm readme:sync
```

## 배포

1. 필요하면 `packages/react-file-preview/package.json`에 `author`를 채웁니다.
2. `pnpm changeset`으로 변경 내역을 작성하고, `pnpm version-packages`로 버전을 올립니다.
3. `cd packages/react-file-preview && npm publish`를 실행합니다. `prepublishOnly`가 빌드와 테스트를 먼저 수행합니다.
